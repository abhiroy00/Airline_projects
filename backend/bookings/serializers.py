
from rest_framework import serializers
from .models import Flight, Seat, Booking, BookingState

class FlightSerializer(serializers.ModelSerializer):
    available_seats = serializers.SerializerMethodField()
    
    class Meta:
        model = Flight
        fields = ['id', 'flight_number', 'origin', 'destination', 
                  'departure_date', 'departure_time', 'price', 
                  'total_seats', 'available_seats']
    
    def get_available_seats(self, obj):
        return obj.seats.filter(is_available=True).count()

class SeatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Seat
        fields = ['id', 'seat_number', 'seat_type', 'is_available']

class BookingSerializer(serializers.ModelSerializer):
    flight_details = FlightSerializer(source='flight', read_only=True)
    seat_details = SeatSerializer(source='seat', read_only=True)
    
    class Meta:
        model = Booking
        fields = ['id', 'flight', 'seat', 'state', 'passenger_name', 
                  'passenger_email', 'passenger_phone', 'hold_expires_at',
                  'confirmed_at', 'cancelled_at', 'payment_amount',
                  'payment_reference', 'refund_processed', 'created_at',
                  'flight_details', 'seat_details']
        read_only_fields = ['state', 'hold_expires_at', 'confirmed_at', 
                           'cancelled_at', 'refund_processed']

class CreateBookingSerializer(serializers.Serializer):
    flight_id = serializers.IntegerField()
    seat_id = serializers.IntegerField()
    passenger_name = serializers.CharField(max_length=200)
    passenger_email = serializers.EmailField()
    passenger_phone = serializers.CharField(max_length=20)

class PaymentSerializer(serializers.Serializer):
    card_number = serializers.CharField(max_length=16)
    expiry_date = serializers.CharField(max_length=5)
    cvv = serializers.CharField(max_length=4)
