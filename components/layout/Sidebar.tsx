'use client';

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-title">Sidebar</div>
      <nav className="sidebar-nav">
        <a href="#map">Map</a>
        <a href="#panel">District Details</a>
        <a href="#table">Risk Table</a>
        <a href="#alerts">Alerts</a>
      </nav>
    </aside>
  );
}