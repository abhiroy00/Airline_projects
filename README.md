

# Check availability under lock
if not seat.is_available:
    raise SeatNotAvailable

# Create booking and mark unavailable
# All within same transaction
State Transition Safety
Problem: Concurrent state changes to same booking
Solution:

Optimistic locking with state validation
Transaction isolation
State machine validation before transition

python@transaction.atomic
def process_payment(booking_id):
    booking = Booking.objects.select_for_update().get(id=booking_id)
    
    # Validate current state allows this transition
    if not booking.can_transition_to(BookingState.CONFIRMED):
        raise InvalidStateTransition
    
    # Perform transition atomically
    booking.transition_to(BookingState.CONFIRMED)
Seat Hold Expiration
Scheduled Task
Option 1: Django-Q (Lightweight, Redis-backed)
python# Schedule task every 60 seconds
from django_q.tasks import schedule

schedule(
    'yourapp.tasks.expire_seat_holds',
    schedule_type='S',  # Seconds
    minutes=1
)
Option 2: Celery (Production-grade, scalable)
python# celerybeat schedule
CELERY_BEAT_SCHEDULE = {
    'expire-seat-holds': {
        'task': 'yourapp.tasks.expire_seat_holds',
        'schedule': 60.0,
    },
}
Option 3: Management Command + Cron (Simple)
bash# Crontab entry
* * * * * cd /path/to/project && python manage.py expire_bookings
Expiration Logic
python@transaction.atomic
def expire_seat_holds():
    expired = Booking.objects.select_for_update().filter(
        state=BookingState.SEAT_HELD,
        hold_expires_at__lt=timezone.now()
    )
    
    for booking in expired:
        booking.transition_to(BookingState.EXPIRED)
        booking.seat.is_available = True
        booking.seat.save()
Security Considerations
1. Payment Data

Never store CVV or full card numbers
Use payment gateway tokens in production
PCI DSS compliance for real implementation

2. Race Conditions

Use SELECT FOR UPDATE for critical resources
Wrap state transitions in transactions
Validate state before every transition

3. Data Validation

Validate all user inputs
Sanitize passenger information
Email validation for notifications

4. API Security

Add authentication (JWT/Session)
Rate limiting on endpoints
CORS configuration for frontend

Performance Optimization
Database Indexes
pythonclass Booking(models.Model):
    class Meta:
        indexes = [
            models.Index(fields=['state', 'hold_expires_at']),
            models.Index(fields=['passenger_email']),
            models.Index(fields=['flight', 'seat']),
        ]
Query Optimization
python# Use select_related for foreign keys
bookings = Booking.objects.select_related('flight', 'seat').all()

# Prefetch related for reverse relations
flights = Flight.objects.prefetch_related('seats').all()
Caching Strategy
python# Cache flight listings (rarely change)
from django.core.cache import cache

flights = cache.get('available_flights')
if not flights:
    flights = Flight.objects.filter(
        departure_date__gte=timezone.now().date()
    )
    cache.set('available_flights', flights, 300)  # 5 minutes
Monitoring & Logging
Key Metrics

Booking Funnel

Flight views → Seat selections → Bookings created → Payments completed


State Distribution

Count of bookings in each state
Expired booking rate
Payment success rate


Performance

API response times
Database query performance
Lock contention metrics



Logging Points
pythonimport logging
logger = logging.getLogger(__name__)

# Critical operations
logger.info(f"Booking created: {booking.id}")
logger.warning(f"Seat hold expired: {booking.id}")
logger.error(f"Payment failed: {booking.id}")
Deployment Checklist
Backend Setup

Install dependencies

bashpip install django djangorestframework django-cors-headers psycopg2-binary
pip install django-q redis  # or celery

Configure database

pythonDATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'airline_booking',
        # ... other settings
    }
}

Run migrations

bashpython manage.py makemigrations
python manage.py migrate

Create sample data

bashpython manage.py create_sample_flights

Start background worker

bashpython manage.py qcluster  # Django-Q
# or
celery -A project_name worker --beat  # Celery
Frontend Setup

Create React app

bashnpx create-react-app airline-booking
cd airline-booking
npm install lucide-react

Configure API endpoint

javascriptconst API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

Build and deploy

bashnpm run build
Testing Strategy
Unit Tests

State machine transitions
Model validation
Business logic

Integration Tests

API endpoints
Database transactions
State changes

Load Tests

Concurrent booking attempts
Race condition scenarios
Performance under load
