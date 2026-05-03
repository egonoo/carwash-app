import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import './styles.css';

const customerSteps = [
  'Home',
  'Vehicle',
  'Location',
  'Date/Time',
  'Package',
  'Add-ons',
  'Summary',
  'Deposit',
  'Waiting',
  'Assigned',
  'In Progress',
  'Completed',
  'Review'
];

const booking = {
  vehicle: 'SUV',
  location: '123 Main St, Austin, TX',
  datetime: 'Tue, May 5 • 10:30 AM',
  pkg: 'Premium Detail',
  addons: ['Tire Shine', 'Pet Hair Removal'],
  price: '$119',
  deposit: '$20'
};

function AppShell({ title, children, flow, step }) {
  return (
    <div className="app">
      <header>
        <h1>CarWash Demo</h1>
        <nav>
          <NavLink to="/">Customer</NavLink>
          <NavLink to="/provider">Provider</NavLink>
          <NavLink to="/admin">Admin</NavLink>
        </nav>
      </header>
      <main>
        <h2>{title}</h2>
        {flow === 'customer' && <Progress current={step} />}
        {children}
      </main>
    </div>
  );
}

function Progress({ current }) {
  return <div className="progress">{customerSteps.map((s, i) => <span key={s} className={i <= current ? 'on' : ''}>{i + 1}. {s}</span>)}</div>;
}

function Card({ title, text, action, to }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <p>{text}</p>
      {to && <Link className="btn" to={to}>{action}</Link>}
    </div>
  );
}

const customerScreens = [
  ['/', 'Home Screen', 'Book a mobile wash now.', '/customer/vehicle', 'Start Booking'],
  ['/customer/vehicle', 'Vehicle Selection', 'Choose Sedan, SUV, Truck, or Van.', '/customer/location', 'Continue'],
  ['/customer/location', 'Location Input', booking.location, '/customer/date-time', 'Save Address'],
  ['/customer/date-time', 'Date & Time Selection', booking.datetime, '/customer/package', 'Confirm Slot'],
  ['/customer/package', 'Package Selection', booking.pkg + ' • ' + booking.price, '/customer/addons', 'Choose Add-ons'],
  ['/customer/addons', 'Add-ons Selection', booking.addons.join(', '), '/customer/summary', 'Review Booking'],
  ['/customer/summary', 'Booking Summary', `${booking.vehicle} • ${booking.datetime} • ${booking.price}`, '/customer/deposit', 'Pay Deposit'],
  ['/customer/deposit', 'Deposit Payment (Mock)', `Card **** 4242 • Deposit ${booking.deposit}`, '/customer/waiting', 'Submit Payment'],
  ['/customer/waiting', 'Waiting for Provider', 'Searching nearby providers...', '/customer/assigned', 'Simulate Match'],
  ['/customer/assigned', 'Provider Assigned', 'Alex R. • ETA 18 min • 4.9★', '/customer/in-progress', 'Track Service'],
  ['/customer/in-progress', 'Service in Progress', 'Foam wash and interior vacuum started.', '/customer/completed', 'Mark Complete'],
  ['/customer/completed', 'Service Completed', 'Before/after photos uploaded. Total: $119', '/customer/review', 'Leave Review'],
  ['/customer/review', 'Review Screen', 'Rate your experience and add comments.', '/', 'Finish']
];

function CustomerPage({ idx, title, text, next, action }) {
  return (
    <AppShell title={title} flow="customer" step={idx}>
      <Card title={title} text={text} to={next} action={action} />
    </AppShell>
  );
}

function ProviderDashboard() {
  return <AppShell title="Provider Dashboard"><div className="grid"><Card title="Availability Toggle" text="You are currently Offline" to="/provider/availability" action="Set Availability" /><Card title="Job List" text="2 nearby assigned jobs" to="/provider/jobs" action="Open Jobs" /></div></AppShell>;
}

function ProviderAvailability() {
  return <AppShell title="Availability Toggle"><Card title="Go Online" text="Tap to receive new booking requests." to="/provider/jobs" action="Toggle Online" /></AppShell>;
}

function ProviderJobs() {
  return <AppShell title="Job List"><div className="grid"><Card title="Job #CW-1021" text="SUV • 123 Main St • 10:30 AM" to="/provider/jobs/1021" action="View Job" /><Card title="Job #CW-1030" text="Sedan • 8th Ave • 11:30 AM" to="/provider/jobs/1030" action="View Job" /></div></AppShell>;
}

function ProviderJobDetail() {
  return <AppShell title="Job Detail"><Card title="Booking Details" text="Package: Premium Detail • Add-ons: Tire Shine" to="/provider/jobs/before-photos" action="Upload Before Photos" /></AppShell>;
}

function ProviderBeforePhotos() {
  return <AppShell title="Upload Before Photos (Mock)"><Card title="Before Photos" text="3 images attached (mock placeholders)." to="/provider/jobs/start" action="Start Service" /></AppShell>;
}

function ProviderStart() {
  return <AppShell title="Start Service"><Card title="Service Started" text="Timer running. Customer notified." to="/provider/jobs/after-photos" action="Upload After Photos" /></AppShell>;
}

function ProviderAfterPhotos() {
  return <AppShell title="Upload After Photos (Mock)"><Card title="After Photos" text="4 images attached (mock placeholders)." to="/provider/jobs/complete" action="Complete Job" /></AppShell>;
}

function ProviderComplete() {
  return <AppShell title="Complete Job"><Card title="Job Completed" text="Payout pending and review requested." to="/provider" action="Back to Dashboard" /></AppShell>;
}

function AdminPage({ title, cards }) {
  return <AppShell title={title}><div className="grid">{cards.map(c => <Card key={c.title} {...c} />)}</div></AppShell>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {customerScreens.map(([path, title, text, next, action], i) => (
          <Route key={path} path={path} element={<CustomerPage idx={i} title={title} text={text} next={next} action={action} />} />
        ))}

        <Route path="/provider" element={<ProviderDashboard />} />
        <Route path="/provider/availability" element={<ProviderAvailability />} />
        <Route path="/provider/jobs" element={<ProviderJobs />} />
        <Route path="/provider/jobs/:id" element={<ProviderJobDetail />} />
        <Route path="/provider/jobs/before-photos" element={<ProviderBeforePhotos />} />
        <Route path="/provider/jobs/start" element={<ProviderStart />} />
        <Route path="/provider/jobs/after-photos" element={<ProviderAfterPhotos />} />
        <Route path="/provider/jobs/complete" element={<ProviderComplete />} />

        <Route path="/admin" element={<AdminPage title="Admin Dashboard" cards={[{ title: 'Providers', text: '14 active providers this week', to: '/admin/providers', action: 'View Providers' }, { title: 'Bookings', text: '58 bookings scheduled today', to: '/admin/bookings', action: 'View Bookings' }]} />} />
        <Route path="/admin/providers" element={<AdminPage title="Providers List" cards={[{ title: 'Alex R.', text: 'Online • Rating 4.9 • 32 jobs', to: '/admin', action: 'Back' }, { title: 'Taylor M.', text: 'Offline • Rating 4.7 • 20 jobs', to: '/admin', action: 'Back' }]} />} />
        <Route path="/admin/bookings" element={<AdminPage title="Bookings List" cards={[{ title: '#CW-1021', text: 'Assigned • Premium Detail • $119', to: '/admin', action: 'Back' }, { title: '#CW-1030', text: 'Waiting • Basic Wash • $49', to: '/admin', action: 'Back' }]} />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')).render(<App />);
