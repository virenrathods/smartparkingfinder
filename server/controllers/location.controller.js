const db = require('../config/db');

// GET /api/locations
async function getAllLocations(req, res, next) {
  try {
    const { search, city, minPrice, maxPrice, availableOnly } = req.query;

    let sql = `
      SELECT 
        l.id, l.name, l.address, l.city, l.state, l.postal_code,
        l.latitude, l.longitude, l.hourly_rate, l.total_slots,
        l.opening_time, l.closing_time, l.is_active, l.description, l.image_url,
        COUNT(s.id) AS actual_slot_count,
        SUM(CASE WHEN s.status = 'available' AND s.is_active = 1 THEN 1 ELSE 0 END) AS available_slots,
        SUM(CASE WHEN s.status = 'occupied' THEN 1 ELSE 0 END) AS occupied_slots,
        SUM(CASE WHEN s.status = 'maintenance' THEN 1 ELSE 0 END) AS maintenance_slots
      FROM parking_locations l
      LEFT JOIN parking_slots s ON l.id = s.location_id
      WHERE l.is_active = 1
    `;

    const params = [];

    if (search) {
      sql += ' AND (l.name LIKE ? OR l.address LIKE ? OR l.city LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (city) {
      sql += ' AND LOWER(l.city) = LOWER(?)';
      params.push(city.trim());
    }

    if (minPrice) {
      sql += ' AND l.hourly_rate >= ?';
      params.push(Number(minPrice));
    }

    if (maxPrice) {
      sql += ' AND l.hourly_rate <= ?';
      params.push(Number(maxPrice));
    }

    sql += ' GROUP BY l.id ORDER BY l.id ASC';

    const [rows] = await db.execute(sql, params);

    // If filter availableOnly requested
    let results = rows;
    if (availableOnly === 'true' || availableOnly === true) {
      results = results.filter(loc => Number(loc.available_slots) > 0);
    }

    res.status(200).json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/locations/:id
async function getLocationById(req, res, next) {
  try {
    const locationId = req.params.id;

    const [locations] = await db.execute(
      `SELECT 
        l.*,
        COUNT(s.id) AS actual_slot_count,
        SUM(CASE WHEN s.status = 'available' AND s.is_active = 1 THEN 1 ELSE 0 END) AS available_slots,
        SUM(CASE WHEN s.status = 'occupied' THEN 1 ELSE 0 END) AS occupied_slots,
        SUM(CASE WHEN s.status = 'maintenance' THEN 1 ELSE 0 END) AS maintenance_slots
      FROM parking_locations l
      LEFT JOIN parking_slots s ON l.id = s.location_id
      WHERE l.id = ?
      GROUP BY l.id`,
      [locationId]
    );

    if (locations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Parking location not found.'
      });
    }

    res.status(200).json({
      success: true,
      data: locations[0]
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/locations (Admin)
async function createLocation(req, res, next) {
  try {
    const {
      name, address, city, state, postal_code,
      latitude, longitude, hourly_rate, total_slots,
      opening_time, closing_time, description, image_url,
      auto_create_slots
    } = req.body;

    if (!name || !address || !city || latitude === undefined || longitude === undefined || hourly_rate === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name, address, city, latitude, longitude, and hourly rate are required.'
      });
    }

    const [result] = await db.execute(
      `INSERT INTO parking_locations 
       (name, address, city, state, postal_code, latitude, longitude, hourly_rate, total_slots, opening_time, closing_time, description, image_url, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        name.trim(),
        address.trim(),
        city.trim(),
        state || 'NY',
        postal_code || '10001',
        Number(latitude),
        Number(longitude),
        Number(hourly_rate),
        Number(total_slots) || 10,
        opening_time || '06:00',
        closing_time || '23:00',
        description || null,
        image_url || 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80'
      ]
    );

    const locationId = result.insertId;

    // Optional convenience: auto-create initial slots
    const slotsCount = Number(total_slots) || 10;
    if (auto_create_slots !== false && slotsCount > 0) {
      for (let i = 1; i <= slotsCount; i++) {
        const slotNumber = `P-${String(i).padStart(2, '0')}`;
        let slotType = 'car';
        if (i <= 2) slotType = 'ev';
        else if (i === 3) slotType = 'accessible';
        else if (i === 4) slotType = 'bike';

        await db.execute(
          'INSERT INTO parking_slots (location_id, slot_number, slot_type, status, is_active) VALUES (?, ?, ?, ?, 1)',
          [locationId, slotNumber, slotType, 'available']
        );
      }
    }

    res.status(201).json({
      success: true,
      message: 'Parking location created successfully.',
      data: { id: locationId }
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/locations/:id (Admin)
async function updateLocation(req, res, next) {
  try {
    const locationId = req.params.id;
    const {
      name, address, city, state, postal_code,
      latitude, longitude, hourly_rate, opening_time, closing_time,
      description, image_url, is_active
    } = req.body;

    const [existing] = await db.execute('SELECT id FROM parking_locations WHERE id = ?', [locationId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Parking location not found.' });
    }

    await db.execute(
      `UPDATE parking_locations SET
        name = COALESCE(?, name),
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        state = COALESCE(?, state),
        postal_code = COALESCE(?, postal_code),
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude),
        hourly_rate = COALESCE(?, hourly_rate),
        opening_time = COALESCE(?, opening_time),
        closing_time = COALESCE(?, closing_time),
        description = COALESCE(?, description),
        image_url = COALESCE(?, image_url),
        is_active = COALESCE(?, is_active)
      WHERE id = ?`,
      [
        name ? name.trim() : null,
        address ? address.trim() : null,
        city ? city.trim() : null,
        state || null,
        postal_code || null,
        latitude !== undefined ? Number(latitude) : null,
        longitude !== undefined ? Number(longitude) : null,
        hourly_rate !== undefined ? Number(hourly_rate) : null,
        opening_time || null,
        closing_time || null,
        description || null,
        image_url || null,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        locationId
      ]
    );

    res.status(200).json({
      success: true,
      message: 'Parking location updated successfully.'
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/locations/:id (Admin)
async function deleteLocation(req, res, next) {
  try {
    const locationId = req.params.id;

    // Check if there are active bookings
    const [activeBookings] = await db.execute(
      "SELECT id FROM bookings WHERE location_id = ? AND booking_status = 'confirmed'",
      [locationId]
    );

    if (activeBookings.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete location with active confirmed bookings. Deactivate it instead.'
      });
    }

    await db.execute('UPDATE parking_locations SET is_active = 0 WHERE id = ?', [locationId]);

    res.status(200).json({
      success: true,
      message: 'Parking location deactivated successfully.'
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation
};
