-- Seed data for Smart Parking Finder

-- 1. Insert Initial Users (Passwords: Admin@123, User@123)
INSERT INTO users (id, full_name, email, password_hash, phone, role) VALUES
(1, 'System Administrator', 'admin@parkingfinder.com', '$2b$10$yuPrwRPp1jQheC4ioe9.L.2BFuzMw4aNQesEv2Yx9C8.ollGsluyi', '+1-555-0199', 'admin'),
(2, 'Alex Johnson (Student Driver)', 'user@parkingfinder.com', '$2b$10$BkqMGVImh6zwoE522S55LeAg6rlH8afD3ri0pakg5CdtY12BZmThO', '+1-555-0142', 'user'),
(3, 'Sarah Miller', 'sarah@example.com', '$2b$10$BkqMGVImh6zwoE522S55LeAg6rlH8afD3ri0pakg5CdtY12BZmThO', '+1-555-0188', 'user');

-- 2. Insert Parking Locations
INSERT INTO parking_locations (id, name, address, city, state, postal_code, latitude, longitude, hourly_rate, total_slots, opening_time, closing_time, is_active, description, image_url) VALUES
(1, 'Grand Central Metro Parking', '100 Metro Plaza, Center District', 'Metropolis', 'NY', '10001', 40.752726, -73.977229, 4.50, 16, '06:00', '23:30', 1, 'Multi-level covered facility connected directly to the central transit hub. High security with 24/7 patrol.', 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80'),
(2, 'Tech Corridor Silicon Plaza', '45 Innovation Way, Tech Park', 'Metropolis', 'NY', '10012', 40.741895, -73.989308, 3.00, 12, '07:00', '22:00', 1, 'Modern parking deck equipped with high-speed EV chargers and reserved accessible slots.', 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=800&q=80'),
(3, 'Harborfront Waterfront Garage', '80 Pier Avenue, Marina Quarter', 'Metropolis', 'NY', '10004', 40.703312, -74.017032, 5.00, 14, '00:00', '23:59', 1, 'Scenic bay-view parking deck steps away from downtown dining, ferry terminals, and parks.', 'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?auto=format&fit=crop&w=800&q=80'),
(4, 'University District East Deck', '220 Academic Boulevard', 'Metropolis', 'NY', '10025', 40.807535, -73.962573, 2.50, 12, '06:00', '22:00', 1, 'Affordable, student-friendly campus perimeter parking with wide bays and bike racks.', 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80');

-- 3. Insert Parking Slots for Location 1 (Grand Central Metro Parking)
INSERT INTO parking_slots (location_id, slot_number, slot_type, status, is_active) VALUES
(1, 'A-01', 'car', 'available', 1),
(1, 'A-02', 'car', 'available', 1),
(1, 'A-03', 'car', 'available', 1),
(1, 'A-04', 'car', 'available', 1),
(1, 'A-05', 'car', 'available', 1),
(1, 'A-06', 'car', 'available', 1),
(1, 'B-01', 'ev', 'available', 1),
(1, 'B-02', 'ev', 'available', 1),
(1, 'B-03', 'car', 'available', 1),
(1, 'B-04', 'car', 'available', 1),
(1, 'C-01', 'accessible', 'available', 1),
(1, 'C-02', 'accessible', 'available', 1),
(1, 'D-01', 'bike', 'available', 1),
(1, 'D-02', 'bike', 'available', 1),
(1, 'D-03', 'car', 'maintenance', 1),
(1, 'D-04', 'car', 'available', 1);

-- Insert Parking Slots for Location 2 (Tech Corridor Silicon Plaza)
INSERT INTO parking_slots (location_id, slot_number, slot_type, status, is_active) VALUES
(2, 'TC-01', 'car', 'available', 1),
(2, 'TC-02', 'car', 'available', 1),
(2, 'TC-03', 'car', 'available', 1),
(2, 'TC-04', 'car', 'available', 1),
(2, 'TC-05', 'ev', 'available', 1),
(2, 'TC-06', 'ev', 'available', 1),
(2, 'TC-07', 'ev', 'available', 1),
(2, 'TC-08', 'accessible', 'available', 1),
(2, 'TC-09', 'bike', 'available', 1),
(2, 'TC-10', 'bike', 'available', 1),
(2, 'TC-11', 'car', 'available', 1),
(2, 'TC-12', 'car', 'available', 1);

-- Insert Parking Slots for Location 3 (Harborfront Waterfront Garage)
INSERT INTO parking_slots (location_id, slot_number, slot_type, status, is_active) VALUES
(3, 'HB-01', 'car', 'available', 1),
(3, 'HB-02', 'car', 'available', 1),
(3, 'HB-03', 'car', 'available', 1),
(3, 'HB-04', 'car', 'available', 1),
(3, 'HB-05', 'car', 'available', 1),
(3, 'HB-06', 'car', 'available', 1),
(3, 'HB-07', 'ev', 'available', 1),
(3, 'HB-08', 'ev', 'available', 1),
(3, 'HB-09', 'accessible', 'available', 1),
(3, 'HB-10', 'bike', 'available', 1),
(3, 'HB-11', 'car', 'available', 1),
(3, 'HB-12', 'car', 'available', 1),
(3, 'HB-13', 'car', 'available', 1),
(3, 'HB-14', 'car', 'available', 1);

-- Insert Parking Slots for Location 4 (University District East Deck)
INSERT INTO parking_slots (location_id, slot_number, slot_type, status, is_active) VALUES
(4, 'UD-01', 'car', 'available', 1),
(4, 'UD-02', 'car', 'available', 1),
(4, 'UD-03', 'car', 'available', 1),
(4, 'UD-04', 'car', 'available', 1),
(4, 'UD-05', 'bike', 'available', 1),
(4, 'UD-06', 'bike', 'available', 1),
(4, 'UD-07', 'bike', 'available', 1),
(4, 'UD-08', 'accessible', 'available', 1),
(4, 'UD-09', 'ev', 'available', 1),
(4, 'UD-10', 'car', 'available', 1),
(4, 'UD-11', 'car', 'available', 1),
(4, 'UD-12', 'car', 'available', 1);
