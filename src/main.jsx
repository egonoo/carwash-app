import React, { createContext, useContext, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import './styles.css';

const BookingContext = createContext(null);

const vehicles = [
  { id: 'sedan', name: 'Sedan', category: 'Compact', price: 45 },
  { id: 'suv', name: 'SUV', category: 'Family', price: 65 },
  { id: 'truck', name: 'Truck', category: 'Large', price: 75 },
  { id: 'van', name: 'Van', category: 'Commercial', price: 70 }
];

const packages = [
  { id: 'basic', name: 'Basic Wash', description: 'Exterior wash and dry', price: 35 },
  { id: 'deluxe', name: 'Deluxe Detail', description: 'Exterior + interior vacuum', price: 65 },
  { id: 'premium', name: 'Premium Complete', description: 'Full detail with wax finish', price: 95 }
];

const addons = [
  { id: 'pet-hair-removal', name: 'Pet Hair Removal', minimumPrice: 15, priceLabel: 'Starting at $15' },
  { id: 'extra-vacuuming', name: 'Extra Vacuuming', minimumPrice: 20, priceLabel: '$20' },
  { id: 'water-spot-removal', name: 'Water Spot Removal', minimumPrice: 30, priceLabel: 'Starting at $30' },
  { id: 'exterior-plastic-protection', name: 'Exterior Plastic Protection', minimumPrice: 10, priceLabel: '$10' },
  { id: 'headlight-restoration', name: 'Headlight Restoration', minimumPrice: 30, priceLabel: '$30' },
  { id: 'hand-wax', name: 'Hand Wax', minimumPrice: 35, priceLabel: 'Starting at $35' },
  { id: 'tree-sap-removal', name: 'Tree Sap Removal', minimumPrice: 10, priceLabel: 'Starting at $10' },
  { id: 'plastic-mat-wash', name: 'Plastic Mat Wash', minimumPrice: 10, priceLabel: '$10' },
  { id: 'carpet-mat-cleaning', name: 'Carpet Mat Cleaning', minimumPrice: 20, priceLabel: '$20' },
  { id: 'engine-wash', name: 'Engine Wash', minimumPrice: 85, priceLabel: '$85' },
  { id: 'rim-detail', name: 'Rim Detail', minimumPrice: 10, priceLabel: '$10 each' },
  { id: 'roof-cleaning', name: 'Roof Cleaning', minimumPrice: 25, priceLabel: 'Starting at $25' },
  { id: 'carpet-cleaning', name: 'Carpet Cleaning', minimumPrice: 49, priceLabel: 'Starting at $49' },
  { id: 'overspray-removal', name: 'Overspray Removal', minimumPrice: 0, priceLabel: 'Price based on vehicle condition' }
];

const steps = ['Vehicle', 'Location', 'Date & Time', 'Package', 'Add-ons', 'Summary', 'Deposit'];

function BookingProvider({ children }) {
  const [booking, setBooking] = useState({
    vehicleId: '',
    location: {
      streetAddress: '',
      aptUnit: '',
      city: '',
      state: '',
      zipCode: ''
    },
    date: '',
    time: '',
    packageId: '',
    addonIds: []
  });

  const value = useMemo(() => ({ booking, setBooking }), [booking]);
  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

function useBooking() {
  const context = useContext(BookingContext);
  if (!context) throw new Error('useBooking must be used within BookingProvider');
  return context;
}

function AppShell({ title, children }) {
  return (
    <div className="app">
      <header>
        <h1>CarWash MVP</h1>
        <nav>
          <NavLink to="/">Customer</NavLink>
          <NavLink to="/provider">Provider</NavLink>
          <NavLink to="/admin">Admin</NavLink>
        </nav>
      </header>
      <main>
        <h2>{title}</h2>
        {children}
      </main>
    </div>
  );
}

function CustomerBookingFlow() {
  const { booking, setBooking } = useBooking();
  const [stepIndex, setStepIndex] = useState(0);

  const formattedAddress = [
    booking.location.streetAddress,
    booking.location.aptUnit,
    `${booking.location.city}${booking.location.city && booking.location.state ? ', ' : ''}${booking.location.state} ${booking.location.zipCode}`.trim()
  ]
    .filter(Boolean)
    .join(', ');

  const selectedVehicle = vehicles.find((v) => v.id === booking.vehicleId);
  const selectedPackage = packages.find((p) => p.id === booking.packageId);
  const selectedAddons = addons.filter((a) => booking.addonIds.includes(a.id));
  const addonsTotal = selectedAddons.reduce((sum, addon) => sum + addon.minimumPrice, 0);

  const subtotal = (selectedVehicle?.price || 0) + (selectedPackage?.price || 0) + addonsTotal;
  const deposit = 20;
  const dueToday = Math.min(deposit, subtotal);
  const remaining = Math.max(0, subtotal - dueToday);

  const canProceed = [
    Boolean(booking.vehicleId),
    Boolean(booking.location.streetAddress.trim() && booking.location.city.trim() && booking.location.state.trim() && booking.location.zipCode.trim()),
    Boolean(booking.date && booking.time),
    Boolean(booking.packageId),
    true,
    subtotal > 0,
    true
  ];

  const toggleAddon = (id) => {
    setBooking((prev) => ({
      ...prev,
      addonIds: prev.addonIds.includes(id) ? prev.addonIds.filter((addonId) => addonId !== id) : [...prev.addonIds, id]
    }));
  };

  return (
    <AppShell title="Customer Booking">
      <div className="progress">{steps.map((step, i) => <span key={step} className={i <= stepIndex ? 'on' : ''}>{i + 1}. {step}</span>)}</div>

      <section className="card">
        {stepIndex === 0 && (
          <div>
            <h3>Select vehicle</h3>
            <div className="grid">{vehicles.map((vehicle) => (
              <button key={vehicle.id} className={`choice ${booking.vehicleId === vehicle.id ? 'selected' : ''}`} onClick={() => setBooking((prev) => ({ ...prev, vehicleId: vehicle.id }))}>
                <strong>{vehicle.name}</strong>
                <span>{vehicle.category}</span>
                <span>${vehicle.price}</span>
              </button>
            ))}</div>
          </div>
        )}

        {stepIndex === 1 && (
          <div>
            <h3>Service location</h3>
            <div className="form-grid">
              <div className="full-width">
                <label htmlFor="streetAddress">Street Address</label>
                <input id="streetAddress" value={booking.location.streetAddress} onChange={(e) => setBooking((prev) => ({ ...prev, location: { ...prev.location, streetAddress: e.target.value } }))} placeholder="123 Main St" required />
              </div>
              <div className="full-width">
                <label htmlFor="aptUnit">Apt / Unit</label>
                <input id="aptUnit" value={booking.location.aptUnit} onChange={(e) => setBooking((prev) => ({ ...prev, location: { ...prev.location, aptUnit: e.target.value } }))} placeholder="Apt 4B (optional)" />
              </div>
              <div>
                <label htmlFor="city">City</label>
                <input id="city" value={booking.location.city} onChange={(e) => setBooking((prev) => ({ ...prev, location: { ...prev.location, city: e.target.value } }))} required />
              </div>
              <div>
                <label htmlFor="state">State</label>
                <input id="state" value={booking.location.state} onChange={(e) => setBooking((prev) => ({ ...prev, location: { ...prev.location, state: e.target.value } }))} placeholder="CA" required />
              </div>
              <div>
                <label htmlFor="zipCode">ZIP Code</label>
                <input id="zipCode" value={booking.location.zipCode} onChange={(e) => setBooking((prev) => ({ ...prev, location: { ...prev.location, zipCode: e.target.value } }))} required />
              </div>
            </div>
          </div>
        )}

        {stepIndex === 2 && (
          <div className="row">
            <div>
              <h3>Select date</h3>
              <input type="date" value={booking.date} onChange={(e) => setBooking((prev) => ({ ...prev, date: e.target.value }))} />
            </div>
            <div>
              <h3>Select time</h3>
              <input type="time" value={booking.time} onChange={(e) => setBooking((prev) => ({ ...prev, time: e.target.value }))} />
            </div>
          </div>
        )}

        {stepIndex === 3 && (
          <div>
            <h3>Select package</h3>
            <div className="grid">{packages.map((pkg) => (
              <button key={pkg.id} className={`choice ${booking.packageId === pkg.id ? 'selected' : ''}`} onClick={() => setBooking((prev) => ({ ...prev, packageId: pkg.id }))}>
                <strong>{pkg.name}</strong>
                <span>{pkg.description}</span>
                <span>${pkg.price}</span>
              </button>
            ))}</div>
          </div>
        )}

        {stepIndex === 4 && (
          <div>
            <h3>Select add-ons</h3>
            <div className="grid">{addons.map((addon) => (
              <button key={addon.id} className={`choice ${booking.addonIds.includes(addon.id) ? 'selected' : ''}`} onClick={() => toggleAddon(addon.id)}>
                <strong>{addon.name}</strong>
                <span>{addon.priceLabel}</span>
              </button>
            ))}</div>
          </div>
        )}

        {stepIndex === 5 && (
          <div>
            <h3>Booking summary</h3>
            <ul className="summary">
              <li>Vehicle: {selectedVehicle ? `${selectedVehicle.name} ($${selectedVehicle.price})` : '-'}</li>
              <li>Address: {formattedAddress || '-'}</li>
              <li>Date: {booking.date || '-'} at {booking.time || '-'}</li>
              <li>Package: {selectedPackage ? `${selectedPackage.name} ($${selectedPackage.price})` : '-'}</li>
              <li>Add-ons: {selectedAddons.length ? selectedAddons.map((a) => `${a.name} (${a.priceLabel})`).join(', ') : 'None'}</li>
              <li>Add-ons minimum total: ${addonsTotal}</li>
              <li><strong>Total: ${subtotal}</strong></li>
            </ul>
          </div>
        )}

        {stepIndex === 6 && (
          <div>
            <h3>Deposit</h3>
            <p>Service address: {formattedAddress || '-'}</p>
            <p>Total: ${subtotal}</p>
            <p>Deposit due now: ${dueToday}</p>
            <p>Remaining balance at completion: ${remaining}</p>
            <p className="meta">Backend payload address: {formattedAddress || '-'}</p>
          </div>
        )}
      </section>

      <div className="actions">
        <button className="btn secondary" disabled={stepIndex === 0} onClick={() => setStepIndex((s) => Math.max(0, s - 1))}>Back</button>
        <button className="btn" disabled={stepIndex === steps.length - 1 || !canProceed[stepIndex]} onClick={() => setStepIndex((s) => Math.min(steps.length - 1, s + 1))}>Next</button>
      </div>
    </AppShell>
  );
}

function ProviderDashboard() {
  return (
    <AppShell title="Provider Dashboard">
      <div className="grid">
        <article className="card"><h3>Today Jobs</h3><p>3 assigned services</p></article>
        <article className="card"><h3>Earnings</h3><p>$248 scheduled payout</p></article>
        <article className="card"><h3>Average Rating</h3><p>4.8 from 96 reviews</p></article>
        <article className="card"><h3>Availability</h3><p>Online and accepting new bookings</p></article>
      </div>
    </AppShell>
  );
}

function AdminDashboard() {
  return (
    <AppShell title="Admin Dashboard">
      <div className="grid">
        <article className="card"><h3>Total Bookings</h3><p>62 bookings this week</p></article>
        <article className="card"><h3>Active Providers</h3><p>14 providers online right now</p></article>
        <article className="card"><h3>Revenue</h3><p>$5,940 processed this week</p></article>
        <article className="card"><h3>Customer Satisfaction</h3><p>4.7 average score</p></article>
      </div>
    </AppShell>
  );
}

function App() {
  return (
    <BrowserRouter>
      <BookingProvider>
        <Routes>
          <Route path="/" element={<CustomerBookingFlow />} />
          <Route path="/provider" element={<ProviderDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </BookingProvider>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')).render(<App />);
