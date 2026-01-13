from django.urls import path
from .views import (
    FlightListView,
    FlightDetailView,
    FlightSeatsView,
    BookingListCreateView,
    BookingDetailView,
    BookingProcessPaymentView,
    BookingCancelView,
    BookingRefundView,
    BookingExpireSeatsView
)

urlpatterns = [
    # Flight endpoints
    path('flights/', FlightListView.as_view(), name='flight-list'),
    path('flights/<int:pk>/', FlightDetailView.as_view(), name='flight-detail'),
    path('flights/<int:pk>/seats/', FlightSeatsView.as_view(), name='flight-seats'),
    
    # Booking endpoints
    path('bookings/', BookingListCreateView.as_view(), name='booking-list-create'),
    path('bookings/<int:pk>/', BookingDetailView.as_view(), name='booking-detail'),
    path('bookings/<int:pk>/process-payment/', BookingProcessPaymentView.as_view(), name='booking-process-payment'),
    path('bookings/<int:pk>/cancel/', BookingCancelView.as_view(), name='booking-cancel'),
    path('bookings/<int:pk>/refund/', BookingRefundView.as_view(), name='booking-refund'),
    path('bookings/expire-seats/', BookingExpireSeatsView.as_view(), name='booking-expire-seats'),
]