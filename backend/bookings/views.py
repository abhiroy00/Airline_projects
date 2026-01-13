# bookings/views.py
# REPLACE YOUR ENTIRE views.py FILE WITH THIS

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.shortcuts import get_object_or_404
from .models import Flight, Seat, Booking, BookingState
from .serializers import (
    FlightSerializer, SeatSerializer, BookingSerializer,
    CreateBookingSerializer, PaymentSerializer
)
import random
import uuid


class FlightListView(APIView):
    """
    GET /api/flights/ - List all flights
    """
    def get(self, request):
        flights = Flight.objects.all()
        serializer = FlightSerializer(flights, many=True)
        return Response(serializer.data)


class FlightDetailView(APIView):
    """
    GET /api/flights/{id}/ - Get flight details
    """
    def get(self, request, pk):
        flight = get_object_or_404(Flight, pk=pk)
        serializer = FlightSerializer(flight)
        return Response(serializer.data)


class FlightSeatsView(APIView):
    """
    GET /api/flights/{id}/seats/ - Get all seats for a flight
    """
    def get(self, request, pk):
        flight = get_object_or_404(Flight, pk=pk)
        seats = flight.seats.all()
        serializer = SeatSerializer(seats, many=True)
        return Response(serializer.data)


class BookingListCreateView(APIView):
    """
    GET /api/bookings/ - List all bookings
    POST /api/bookings/ - Create a new booking
    """
    
    def get(self, request):
        """List all bookings"""
        bookings = Booking.objects.all()
        serializer = BookingSerializer(bookings, many=True)
        return Response(serializer.data)
    
    @transaction.atomic
    def post(self, request):
        """Create a new booking and lock the seat"""
        serializer = CreateBookingSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        flight_id = serializer.validated_data['flight_id']
        seat_id = serializer.validated_data['seat_id']
        
        # Get flight and seat with row lock
        flight = get_object_or_404(Flight, id=flight_id)
        seat = get_object_or_404(
            Seat.objects.select_for_update(),
            id=seat_id,
            flight=flight
        )
        
        # Check seat availability
        if not seat.is_available:
            return Response(
                {'error': 'Seat is not available'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check for active bookings on this seat
        active_bookings = Booking.objects.filter(
            seat=seat,
            state__in=[BookingState.SEAT_HELD, BookingState.PAYMENT_PENDING, 
                      BookingState.CONFIRMED]
        ).exists()
        
        if active_bookings:
            return Response(
                {'error': 'Seat is already booked'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create booking
        booking = Booking.objects.create(
            flight=flight,
            seat=seat,
            passenger_name=serializer.validated_data['passenger_name'],
            passenger_email=serializer.validated_data['passenger_email'],
            passenger_phone=serializer.validated_data['passenger_phone'],
            payment_amount=flight.price,
            state=BookingState.INITIATED
        )
        
        # Transition to SEAT_HELD
        booking.transition_to(BookingState.SEAT_HELD)
        
        # Mark seat as unavailable
        seat.is_available = False
        seat.save()
        
        return Response(
            BookingSerializer(booking).data,
            status=status.HTTP_201_CREATED
        )


class BookingDetailView(APIView):
    """
    GET /api/bookings/{id}/ - Get booking details
    """
    def get(self, request, pk):
        booking = get_object_or_404(Booking, pk=pk)
        serializer = BookingSerializer(booking)
        return Response(serializer.data)


class BookingProcessPaymentView(APIView):
    """
    POST /api/bookings/{id}/process-payment/ - Process payment for a booking
    """
    
    @transaction.atomic
    def post(self, request, pk):
        booking = get_object_or_404(
            Booking.objects.select_for_update(),
            pk=pk
        )
        
        # Check if booking is expired
        if booking.is_expired():
            booking.transition_to(BookingState.EXPIRED)
            booking.seat.is_available = True
            booking.seat.save()
            return Response(
                {'error': 'Booking has expired'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate current state
        if booking.state not in [BookingState.SEAT_HELD, BookingState.PAYMENT_PENDING]:
            return Response(
                {'error': f'Cannot process payment for booking in {booking.state} state'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = PaymentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # First transition to PAYMENT_PENDING if coming from SEAT_HELD
        if booking.state == BookingState.SEAT_HELD:
            booking.transition_to(BookingState.PAYMENT_PENDING)
        
        # Mock payment processing (80% success rate)
        payment_success = random.random() > 0.2
        
        if payment_success:
            booking.payment_reference = str(uuid.uuid4())
            booking.transition_to(BookingState.CONFIRMED)
            
            return Response({
                'success': True,
                'message': 'Payment successful',
                'booking': BookingSerializer(booking).data
            })
        else:
            # Stay in PAYMENT_PENDING for retry
            return Response({
                'success': False,
                'message': 'Payment failed. Please try again.',
                'booking': BookingSerializer(booking).data
            })


class BookingCancelView(APIView):
    """
    POST /api/bookings/{id}/cancel/ - Cancel a booking
    """
    
    @transaction.atomic
    def post(self, request, pk):
        booking = get_object_or_404(
            Booking.objects.select_for_update(),
            pk=pk
        )
        
        # Can only cancel CONFIRMED or SEAT_HELD bookings
        if booking.state not in [BookingState.CONFIRMED, BookingState.SEAT_HELD, 
                                BookingState.PAYMENT_PENDING]:
            return Response(
                {'error': f'Cannot cancel booking in {booking.state} state'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Transition to CANCELLED
        booking.transition_to(BookingState.CANCELLED)
        
        # Release the seat
        booking.seat.is_available = True
        booking.seat.save()
        
        return Response({
            'message': 'Booking cancelled successfully',
            'booking': BookingSerializer(booking).data
        })


class BookingRefundView(APIView):
    """
    POST /api/bookings/{id}/refund/ - Process refund for a cancelled booking
    """
    
    @transaction.atomic
    def post(self, request, pk):
        booking = get_object_or_404(
            Booking.objects.select_for_update(),
            pk=pk
        )
        
        # Can only refund CANCELLED bookings
        if booking.state != BookingState.CANCELLED:
            return Response(
                {'error': 'Can only refund cancelled bookings'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if already refunded
        if booking.refund_processed:
            return Response(
                {'error': 'Refund already processed'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Transition to REFUNDED
        booking.transition_to(BookingState.REFUNDED)
        
        return Response({
            'message': 'Refund processed successfully',
            'booking': BookingSerializer(booking).data
        })


class BookingExpireSeatsView(APIView):
    """
    POST /api/bookings/expire-seats/ - Expire all bookings with expired seat holds
    """
    
    @transaction.atomic
    def post(self, request):
        from django.utils import timezone
        
        expired_bookings = Booking.objects.select_for_update().filter(
            state=BookingState.SEAT_HELD,
            hold_expires_at__lt=timezone.now()
        )
        
        count = 0
        for booking in expired_bookings:
            booking.transition_to(BookingState.EXPIRED)
            booking.seat.is_available = True
            booking.seat.save()
            count += 1
        
        return Response({
            'message': f'Expired {count} bookings',
            'count': count
        })