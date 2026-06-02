require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;
// Fallback base URL if not provided in environment
const PYTHON_BASE_URL = process.env.PYTHON_BASE_URL || 'http://66.116.224.207:8000';

// Middleware
app.use(cors()); // Allow Cross-Origin requests
app.use(express.json()); // Parse incoming JSON requests
app.use(morgan('combined')); // Log HTTP requests for production

// Proxy endpoint (Dynamic for gold and silver rates)
app.get('/api/:type/latest', async (req, res) => {
    try {
        const { type } = req.params;
        const targetUrl = `${PYTHON_BASE_URL}/api/${type}/latest`;

        // Fetch fresh data from the Python API
        const response = await axios.get(targetUrl, {
            // Set a timeout of 10 seconds to prevent hanging requests
            timeout: 10000,
            headers: {
                'Accept': 'application/json'
            }
        });

        // Validation for missing or invalid JSON response body
        if (!response.data) {
            return res.status(502).json({
                error: 'Bad Gateway',
                message: 'Invalid or empty response from Python API'
            });
        }

        // Return the fetched JSON response directly without caching
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.status(response.status).json(response.data);

    } catch (error) {
        console.error('Error proxying data from Python API:', error.message);

        if (error.response) {
            // The request was made and the backend responded with a status code outside of 2xx
            return res.status(error.response.status).json({
                error: 'Backend Error',
                message: 'Python API returned an error',
                details: error.response.data
            });
        } else if (error.request) {
            // The request was made but no response was received (Timeout or network issue)
            if (error.code === 'ECONNABORTED') {
                return res.status(504).json({
                    error: 'Gateway Timeout',
                    message: 'Request to Python API timed out'
                });
            }
            return res.status(503).json({
                error: 'Service Unavailable',
                message: 'Python API is currently unavailable or unreachable'
            });
        } else {
            // Something else triggered an error
            return res.status(500).json({
                error: 'Internal Server Error',
                message: 'An unexpected error occurred while processing the request'
            });
        }
    }
});

// Fallback for undefined routes
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found', message: 'Endpoint does not exist' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled Exception:', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'An unexpected server error occurred' });
});

app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`🚀 Node.js Proxy Server running on port ${PORT}`);
    console.log(`🔗 Proxying /api/:type/latest to: ${PYTHON_BASE_URL}`);
    console.log(`===================================================`);
});
