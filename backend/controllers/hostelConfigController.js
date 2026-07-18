const HostelConfiguration = require('../models/HostelConfiguration');

// GET /api/admin/hostel-configurations
exports.getHostelConfigurations = async (req, res) => {
    try {
        const configs = await HostelConfiguration.find({}).sort({ createdAt: -1 });
        res.json(configs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to retrieve hostel configurations', message: error.message });
    }
};

// GET /api/admin/hostel-configurations/:id
exports.getHostelConfigurationById = async (req, res) => {
    try {
        const config = await HostelConfiguration.findById(req.params.id);
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
            hostelName,
            hostelCode,
            gender,
            roomTemplates,
            isActive: isActive || false
        });
        
        if (newConfig.isActive) {
            // Deactivate all other configurations first
            await HostelConfiguration.updateMany({}, { isActive: false });
        }
        
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
        
        const config = await HostelConfiguration.findById(req.params.id);
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
        
        if (config.isActive) {
            // Deactivate all other configurations
            await HostelConfiguration.updateMany({ _id: { $ne: config._id } }, { isActive: false });
        }
        
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
        const config = await HostelConfiguration.findByIdAndDelete(req.params.id);
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
        const config = await HostelConfiguration.findById(req.params.id);
        if (!config) {
            return res.status(404).json({ error: 'Hostel configuration not found' });
        }
        
        // Deactivate all configurations
        await HostelConfiguration.updateMany({}, { isActive: false });
        
        // Activate this one
        config.isActive = true;
        await config.save();
        
        res.json({ message: 'Hostel configuration activated successfully', config });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to activate hostel configuration', message: error.message });
    }
};
