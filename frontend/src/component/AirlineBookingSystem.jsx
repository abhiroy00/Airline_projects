import React, { useState, useEffect } from 'react';
import { Calendar, Users, CreditCard, CheckCircle, XCircle, Clock, Plane, Loader } from 'lucide-react';

// Real API client
const API_BASE = 'http://localhost:8000/api';

const api = {
  getFlights: async () => {
    const response = await fetch(`${API_BASE}/flights/`);
    if (!response.ok) throw new Error('Failed to fetch flights');
    return response.json();
  },
  
  getSeats: async (flightId) => {
    const response = await fetch(`${API_BASE}/flights/${flightId}/seats/`);
    if (!response.ok) throw new Error('Failed to fetch seats');
    return response.json();
  },
  
  createBooking: async (flightId, seatId, passengerInfo) => {
    const response = await fetch(`${API_BASE}/bookings/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        flight_id: flightId,
        seat_id: seatId,
        passenger_name: passengerInfo.name,
        passenger_email: passengerInfo.email,
        passenger_phone: passengerInfo.phone,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create booking');
    }
    
    return response.json();
  },
  
  processPayment: async (bookingId, paymentInfo) => {
    const response = await fetch(`${API_BASE}/bookings/${bookingId}/process-payment/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        card_number: paymentInfo.cardNumber,
        expiry_date: paymentInfo.expiry,
        cvv: paymentInfo.cvv,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to process payment');
    }
    
    return response.json();
  },
  
  cancelBooking: async (bookingId) => {
    const response = await fetch(`${API_BASE}/bookings/${bookingId}/cancel/`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to cancel booking');
    }
    
    return response.json();
  },
  
  getBooking: async (bookingId) => {
    const response = await fetch(`${API_BASE}/bookings/${bookingId}/`);
    if (!response.ok) throw new Error('Failed to fetch booking');
    return response.json();
  }
};

const AirlineBookingSystem = () => {
  const [currentStep, setCurrentStep] = useState('flights');
  const [flights, setFlights] = useState([]);
  const [seats, setSeats] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [booking, setBooking] = useState(null);
  const [passengerInfo, setPassengerInfo] = useState({ name: '', email: '', phone: '' });
  const [paymentInfo, setPaymentInfo] = useState({ cardNumber: '', expiry: '', cvv: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(null);

  useEffect(() => {
    loadFlights();
  }, []);

  useEffect(() => {
    if (booking && booking.hold_expires_at) {
      const interval = setInterval(() => {
        const now = new Date().getTime();
        const expiry = new Date(booking.hold_expires_at).getTime();
        const diff = expiry - now;
        
        if (diff <= 0) {
          setError('Seat hold expired. Please start over.');
          setTimeRemaining(0);
          clearInterval(interval);
        } else {
          setTimeRemaining(Math.floor(diff / 1000));
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [booking]);

  const loadFlights = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getFlights();
      setFlights(data);
    } catch (err) {
      setError(err.message || 'Failed to load flights');
    }
    setLoading(false);
  };

  const loadSeats = async (flightId) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getSeats(flightId);
      setSeats(data);
    } catch (err) {
      setError(err.message || 'Failed to load seats');
    }
    setLoading(false);
  };

  const handleFlightSelect = async (flight) => {
    setSelectedFlight(flight);
    await loadSeats(flight.id);
    setCurrentStep('seats');
  };

  const handleSeatSelect = (seat) => {
    if (seat.is_available) {
      setSelectedSeat(seat);
    }
  };

  const handleSeatConfirm = () => {
    if (selectedSeat) {
      setCurrentStep('passenger');
    }
  };

  const handlePassengerSubmit = async () => {
    setLoading(true);
    setError('');
    
    try {
      const bookingData = await api.createBooking(
        selectedFlight.id,
        selectedSeat.id,
        passengerInfo
      );
      setBooking(bookingData);
      setCurrentStep('payment');
    } catch (err) {
      setError(err.message || 'Failed to create booking');
    }
    setLoading(false);
  };

  const handlePaymentSubmit = async () => {
    setLoading(true);
    setError('');
    
    try {
      const result = await api.processPayment(booking.id, paymentInfo);
      
      if (result.success) {
        setBooking(result.booking);
        setCurrentStep('confirmation');
      } else {
        setError(result.message || 'Payment failed. Please try again.');
        setBooking(result.booking);
      }
    } catch (err) {
      setError(err.message || 'Payment processing failed');
    }
    setLoading(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const resetBooking = () => {
    setCurrentStep('flights');
    setSelectedFlight(null);
    setSelectedSeat(null);
    setBooking(null);
    setPassengerInfo({ name: '', email: '', phone: '' });
    setPaymentInfo({ cardNumber: '', expiry: '', cvv: '' });
    setError('');
    setTimeRemaining(null);
    loadFlights();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Plane className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-800">Airline Booking System</h1>
          </div>
          
          {/* Progress Steps */}
          <div className="flex items-center justify-between mt-6">
            {['flights', 'seats', 'passenger', 'payment', 'confirmation'].map((step, idx) => (
              <div key={step} className="flex items-center flex-1">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  currentStep === step ? 'bg-indigo-600 text-white' :
                  ['flights', 'seats', 'passenger', 'payment', 'confirmation'].indexOf(currentStep) > idx ? 'bg-green-500 text-white' :
                  'bg-gray-300 text-gray-600'
                }`}>
                  {['flights', 'seats', 'passenger', 'payment', 'confirmation'].indexOf(currentStep) > idx ? 
                    <CheckCircle className="w-6 h-6" /> : idx + 1}
                </div>
                {idx < 4 && <div className="flex-1 h-1 mx-2 bg-gray-300"></div>}
              </div>
            ))}
          </div>
          
          {/* Timer */}
          {timeRemaining !== null && timeRemaining > 0 && booking?.state === 'SEAT_HELD' && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <span className="text-yellow-800 font-semibold">
                Seat hold expires in: {formatTime(timeRemaining)}
              </span>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading && currentStep === 'flights' && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <Loader className="w-12 h-12 animate-spin mx-auto mb-4 text-indigo-600" />
            <p className="text-gray-600">Loading flights...</p>
          </div>
        )}

        {/* Flight Selection */}
        {currentStep === 'flights' && !loading && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Select Your Flight</h2>
            {flights.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No flights available. Please create flights in Django admin.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {flights.map(flight => (
                  <div
                    key={flight.id}
                    onClick={() => handleFlightSelect(flight)}
                    className="border border-gray-200 rounded-lg p-4 hover:border-indigo-500 hover:shadow-md cursor-pointer transition"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-bold text-lg text-gray-800">{flight.flight_number}</div>
                        <div className="text-gray-600">{flight.origin} → {flight.destination}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          <Calendar className="w-4 h-4 inline mr-1" />
                          {flight.departure_date} at {flight.departure_time}
                        </div>
                        <div className="text-sm text-green-600 mt-1">
                          {flight.available_seats} seats available
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-indigo-600">${flight.price}</div>
                        <div className="text-sm text-gray-500">per person</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Seat Selection */}
        {currentStep === 'seats' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Select Your Seat</h2>
            <div className="mb-4 text-gray-600">
              Flight: <span className="font-semibold">{selectedFlight?.flight_number}</span> | 
              {selectedFlight?.origin} → {selectedFlight?.destination}
            </div>
            
            <div className="mb-6">
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-green-500 rounded"></div>
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-600 rounded"></div>
                  <span>Selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-300 rounded"></div>
                  <span>Occupied</span>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <Loader className="w-12 h-12 animate-spin mx-auto mb-4 text-indigo-600" />
                <p className="text-gray-600">Loading seats...</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-6 gap-2 mb-6">
                  {seats.map(seat => (
                    <button
                      key={seat.id}
                      onClick={() => handleSeatSelect(seat)}
                      disabled={!seat.is_available}
                      className={`h-12 rounded font-semibold ${
                        selectedSeat?.id === seat.id ? 'bg-indigo-600 text-white' :
                        seat.is_available ? 'bg-green-500 text-white hover:bg-green-600' :
                        'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {seat.seat_number}
                    </button>
                  ))}
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setCurrentStep('flights')}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSeatConfirm}
                    disabled={!selectedSeat}
                    className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Continue with Seat {selectedSeat?.seat_number}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Passenger Information */}
        {currentStep === 'passenger' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Passenger Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={passengerInfo.name}
                  onChange={(e) => setPassengerInfo({...passengerInfo, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={passengerInfo.email}
                  onChange={(e) => setPassengerInfo({...passengerInfo, email: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={passengerInfo.phone}
                  onChange={(e) => setPassengerInfo({...passengerInfo, phone: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setCurrentStep('seats')}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Back
              </button>
              <button
                onClick={handlePassengerSubmit}
                disabled={loading || !passengerInfo.name || !passengerInfo.email || !passengerInfo.phone}
                className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 flex items-center justify-center gap-2"
              >
                {loading ? <Loader className="w-5 h-5 animate-spin" /> : 'Continue to Payment'}
              </button>
            </div>
          </div>
        )}

        {/* Payment */}
        {currentStep === 'payment' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Payment Details</h2>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Flight:</span>
                <span className="font-semibold">{selectedFlight?.flight_number}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Seat:</span>
                <span className="font-semibold">{selectedSeat?.seat_number}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Passenger:</span>
                <span className="font-semibold">{passengerInfo.name}</span>
              </div>
              <div className="border-t border-gray-300 mt-3 pt-3 flex justify-between">
                <span className="text-lg font-bold">Total:</span>
                <span className="text-2xl font-bold text-indigo-600">${selectedFlight?.price}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
                <input
                  type="text"
                  value={paymentInfo.cardNumber}
                  onChange={(e) => setPaymentInfo({...paymentInfo, cardNumber: e.target.value})}
                  placeholder="4532 1234 5678 9012"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                  <input
                    type="text"
                    value={paymentInfo.expiry}
                    onChange={(e) => setPaymentInfo({...paymentInfo, expiry: e.target.value})}
                    placeholder="12/26"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
                  <input
                    type="text"
                    value={paymentInfo.cvv}
                    onChange={(e) => setPaymentInfo({...paymentInfo, cvv: e.target.value})}
                    placeholder="123"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex gap-4 mt-6">
              <button
                onClick={handlePaymentSubmit}
                disabled={loading || !paymentInfo.cardNumber || !paymentInfo.expiry || !paymentInfo.cvv}
                className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    Pay ${selectedFlight?.price}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Confirmation */}
        {currentStep === 'confirmation' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-2 text-gray-800">Booking Confirmed!</h2>
              <p className="text-gray-600 mb-6">Your ticket has been successfully booked</p>
              
              <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left max-w-md mx-auto">
                <div className="flex justify-between mb-3 pb-3 border-b border-gray-200">
                  <span className="text-gray-600">Booking ID:</span>
                  <span className="font-semibold">{booking?.id}</span>
                </div>
                <div className="flex justify-between mb-3 pb-3 border-b border-gray-200">
                  <span className="text-gray-600">Flight:</span>
                  <span className="font-semibold">{selectedFlight?.flight_number}</span>
                </div>
                <div className="flex justify-between mb-3 pb-3 border-b border-gray-200">
                  <span className="text-gray-600">Route:</span>
                  <span className="font-semibold">{selectedFlight?.origin} → {selectedFlight?.destination}</span>
                </div>
                <div className="flex justify-between mb-3 pb-3 border-b border-gray-200">
                  <span className="text-gray-600">Seat:</span>
                  <span className="font-semibold">{selectedSeat?.seat_number}</span>
                </div>
                <div className="flex justify-between mb-3 pb-3 border-b border-gray-200">
                  <span className="text-gray-600">Passenger:</span>
                  <span className="font-semibold">{passengerInfo.name}</span>
                </div>
                <div className="flex justify-between mb-3 pb-3 border-b border-gray-200">
                  <span className="text-gray-600">Date & Time:</span>
                  <span className="font-semibold">{selectedFlight?.departure_date} at {selectedFlight?.departure_time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Reference:</span>
                  <span className="font-semibold text-xs">{booking?.payment_reference}</span>
                </div>
              </div>

              <button
                onClick={resetBooking}
                className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Book Another Flight
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AirlineBookingSystem;