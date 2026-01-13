from django.db import models
from django.utils import timezone
from datetime import timedelta
from django.core.exceptions import ValidationError

class BookingState(models.TextChoices):
    INITIATED = 'INITIATED', 'Initiated'
    SEAT_HELD = 'SEAT_HELD', 'Seat Held'
    PAYMENT_PENDING = 'PAYMENT_PENDING', 'Payment Pending'
    CONFIRMED = 'CONFIRMED', 'Confirmed'
    CANCELLED = 'CANCELLED', 'Cancelled'
    EXPIRED = 'EXPIRED', 'Expired'
    REFUNDED = 'REFUNDED', 'Refunded'

class Flight(models.Model):
    flight_number = models.CharField(max_length=10, unique=True)
    origin = models.CharField(max_length=100)
    destination = models.CharField(max_length=100)
    departure_date = models.DateField()
    departure_time = models.TimeField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    total_seats = models.IntegerField(default=60)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-departure_date', '-departure_time']

    def __str__(self):
        return f"{self.flight_number} - {self.origin} to {self.destination}"

class Seat(models.Model):
    SEAT_TYPE_CHOICES = [
        ('ECONOMY', 'Economy'),
        ('BUSINESS', 'Business'),
        ('FIRST', 'First Class'),
    ]
    
    flight = models.ForeignKey(Flight, on_delete=models.CASCADE, related_name='seats')
    seat_number = models.CharField(max_length=5)
    seat_type = models.CharField(max_length=10, choices=SEAT_TYPE_CHOICES, default='ECONOMY')
    is_available = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['flight', 'seat_number']
        ordering = ['seat_number']

    def __str__(self):
        return f"{self.flight.flight_number} - Seat {self.seat_number}"

class Booking(models.Model):
    flight = models.ForeignKey(Flight, on_delete=models.PROTECT, related_name='bookings')
    seat = models.ForeignKey(Seat, on_delete=models.PROTECT, related_name='bookings')
    state = models.CharField(
        max_length=20,
        choices=BookingState.choices,
        default=BookingState.INITIATED
    )
    
    # Passenger Information
    passenger_name = models.CharField(max_length=200)
    passenger_email = models.EmailField()
    passenger_phone = models.CharField(max_length=20)
    
    # Timing
    hold_expires_at = models.DateTimeField(null=True, blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    
    # Payment
    payment_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    payment_reference = models.CharField(max_length=100, null=True, blank=True)
    refund_processed = models.BooleanField(default=False)
    refund_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Booking {self.id} - {self.passenger_name} - {self.state}"

    # State Machine Allowed Transitions
    ALLOWED_TRANSITIONS = {
        BookingState.INITIATED: [BookingState.SEAT_HELD],
        BookingState.SEAT_HELD: [BookingState.PAYMENT_PENDING, BookingState.EXPIRED, BookingState.CANCELLED],
        BookingState.PAYMENT_PENDING: [BookingState.CONFIRMED, BookingState.SEAT_HELD, BookingState.CANCELLED],
        BookingState.CONFIRMED: [BookingState.CANCELLED],
        BookingState.CANCELLED: [BookingState.REFUNDED],
        BookingState.EXPIRED: [],
        BookingState.REFUNDED: [],
    }

    def can_transition_to(self, new_state):
        """Check if transition is allowed"""
        return new_state in self.ALLOWED_TRANSITIONS.get(self.state, [])

    def transition_to(self, new_state, save=True):
        """Transition to a new state with validation"""
        if not self.can_transition_to(new_state):
            raise ValidationError(
                f"Invalid state transition from {self.state} to {new_state}"
            )
        
        self.state = new_state
        
        # Set timestamps based on state
        if new_state == BookingState.SEAT_HELD:
            self.hold_expires_at = timezone.now() + timedelta(minutes=10)
        elif new_state == BookingState.CONFIRMED:
            self.confirmed_at = timezone.now()
        elif new_state == BookingState.CANCELLED:
            self.cancelled_at = timezone.now()
        elif new_state == BookingState.REFUNDED:
            self.refund_at = timezone.now()
            self.refund_processed = True
        
        if save:
            self.save()
        
        return self

    def is_expired(self):
        """Check if seat hold has expired"""
        if self.state == BookingState.SEAT_HELD and self.hold_expires_at:
            return timezone.now() > self.hold_expires_at
        return False

