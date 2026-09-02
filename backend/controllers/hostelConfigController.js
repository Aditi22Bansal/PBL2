const HostelConfiguration = require('../models/HostelConfiguration');

// GET /api/admin/hostel-configurations
exports.getHostelConfigurations = async (req, res) => {
    try {
        const configs = await HostelConfiguration.find({ organizationId: req.currentUser.organizationId }).sort({ createdAt: -1 });
        res.json(configs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to retrieve hostel configurations', message: error.message });
    }
};

// GET /api/admin/hostel-configurations/:id
exports.getHostelConfigurationById = async (req, res) => {
    try {
        const config = await HostelConfiguration.findOne({ _id: req.params.id, organizationId: req.currentUser.organizationId });
        if (!config) {
            return res.status(404).json({ error: 'Hostel configuration not found' });
        }
        res.json(config);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to retrieve hostel configuration', message: error.message });
    }
};

// POST /api/admin/hostel-configurations
exports.createHostelConfiguration = async (req, res) => {
    try {
        const { hostelName, hostelCode, gender, roomTemplates, isActive } = req.body;
        
        // Validation
        if (!hostelName) {
            return res.status(400).json({ error: 'Hostel name is required' });
        }
        if (!roomTemplates || !Array.isArray(roomTemplates) || roomTemplates.length === 0) {
            return res.status(400).json({ error: 'Room templates cannot be empty' });
        }
        for (let t of roomTemplates) {
            if (t.capacity === undefined || t.capacity <= 0) {
                return res.status(400).json({ error: 'Room capacity must be greater than 0' });
            }
            if (t.count === undefined || t.count < 0) {
                return res.status(400).json({ error: 'Room count cannot be negative' });
            }
        }
        
        const newConfig = new HostelConfiguration({
            organizationId: req.currentUser.organizationId,
            hostelName,
            hostelCode,
            gender,
            roomTemplates,
            isActive: isActive || false
        });

        // No exclusivity: multiple configs can be active at once for an org
        // (e.g. a Female config and a Male config both active simultaneously
        // is the correct, common case, not an edge case to guard against).
        await newConfig.save();
        res.status(201).json(newConfig);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create hostel configuration', message: error.message });
    }
};

// PUT /api/admin/hostel-configurations/:id
exports.updateHostelConfiguration = async (req, res) => {
    try {
        const { hostelName, hostelCode, gender, roomTemplates, isActive } = req.body;
        
        // Validation
        if (!hostelName) {
            return res.status(400).json({ error: 'Hostel name is required' });
        }
        if (!roomTemplates || !Array.isArray(roomTemplates) || roomTemplates.length === 0) {
            return res.status(400).json({ error: 'Room templates cannot be empty' });
        }
        for (let t of roomTemplates) {
            if (t.capacity === undefined || t.capacity <= 0) {
                return res.status(400).json({ error: 'Room capacity must be greater than 0' });
            }
            if (t.count === undefined || t.count < 0) {
                return res.status(400).json({ error: 'Room count cannot be negative' });
            }
        }
        
        const config = await HostelConfiguration.findOne({ _id: req.params.id, organizationId: req.currentUser.organizationId });
        if (!config) {
            return res.status(404).json({ error: 'Hostel configuration not found' });
        }

        config.hostelName = hostelName;
        config.hostelCode = hostelCode;
        config.gender = gender;
        config.roomTemplates = roomTemplates;

        if (isActive !== undefined) {
            config.isActive = isActive;
        }

        // No exclusivity: multiple configs can be active at once for an org.
        await config.save();
        res.json(config);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update hostel configuration', message: error.message });
    }
};

// DELETE /api/admin/hostel-configurations/:id
exports.deleteHostelConfiguration = async (req, res) => {
    try {
        const config = await HostelConfiguration.findOneAndDelete({ _id: req.params.id, organizationId: req.currentUser.organizationId });
        if (!config) {
            return res.status(404).json({ error: 'Hostel configuration not found' });
        }
        res.json({ message: 'Hostel configuration deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete hostel configuration', message: error.message });
    }
};

// PATCH /api/admin/hostel-configurations/:id/activate
exports.activateHostelConfiguration = async (req, res) => {
    try {
        const config = await HostelConfiguration.findOne({ _id: req.params.id, organizationId: req.currentUser.organizationId });
        if (!config) {
            return res.status(404).json({ error: 'Hostel configuration not found' });
        }

        // No exclusivity: activating this one doesn't deactivate any others -
        // multiple configs can be active at once for an org.
        config.isActive = true;
        await config.save();

        res.json({ message: 'Hostel configuration activated successfully', config });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to activate hostel configuration', message: error.message });
    }
};
