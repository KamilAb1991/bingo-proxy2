const express = require('express');
const axios = require('axios');
const cors = require('cors');
const redis = require('redis');

const app = express();
const PORT = process.env.PORT || 8084;

// Middleware
app.use(cors());
app.use(express.json());

// Logger dla debugowania
app.use((req, res, next) => {
    console.log(`[Proxy Log] Incoming request: ${req.method} ${req.url}`);
    console.log(`[Proxy Log] Headers:`, req.headers);
    console.log(`[Proxy Log] Body:`, req.body);
    next();
});

// Konfiguracja Redis
const redisClient = redis.createClient({
    url: 'rediss://frank-llama-21182.upstash.io', // Twój URL do Redis (Upstash w tym przypadku)
    password: 'AVK-AAIjcDE4MjZiMDI3YzQ2NWM0NTgwODViNWVkY2NkMjU2NTI3MnAxMA', // Hasło do Redis
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.connect();

const hashVbc = '7d997897934a87d208af3ea7df9e8d72'; // Hash dla VBC
const hashWoc = '15a75aebc1a03c0067138ebcd931108e'; // Hash dla WOC

// Endpoint proxy
app.post('/proxy/bingo2', async (req, res) => {
    const { currency, language } = req.body;

    // Walidacja waluty
    let secureLogin;
    if (currency === 'WOC') {
        secureLogin = 'wwvgs_wowvegas';
    } else if (currency === 'VBC') {
        secureLogin = 'wwvgs_wowvegasvbc';
    } else {
        return res.status(400).json({ error: 'Invalid currency' });
    }

    const cacheKey = `bingoRooms2:${currency}:${language}`;
    const xHash = currency === 'VBC' ? hashVbc : hashWoc;

        function formatRequestBody(data) {
        return JSON.stringify(data, null, 0).replace(/:/g, ': ');
    }

    try {
        // Sprawdź cache w Redis
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            console.log('[Proxy Log] Cache hit');
            return res.json(JSON.parse(cachedData));
        }

        console.log('[Proxy Log] Cache miss, fetching from API');
        console.log(`[Proxy Log] Using xHash: ${xHash} for currency: ${currency}`);

        const requestBody = formatRequestBody({
            currency,
            language,
            secureLogin,
        });

        console.log(`[Proxy Log] Sending to API with body:`, requestBody);

        // Wysyłanie żądania do API
        const response = await axios.post(
            'https://api-bingo.prerelease-env.biz/BingoIntegration/BingoGameAPI/RoomList/v2',
            requestBody,
            {
                headers: {
                    'x-hash': xHash,
                    'Content-Type': 'text/plain',
                },
            }
        );

        // Zapisz dane w Redis z czasem wygaśnięcia 30 sekund
        await redisClient.set(cacheKey, JSON.stringify(response.data), {
            EX: 30,
        });

        res.json(response.data);
    } catch (error) {
        console.error('[Proxy Log] Error fetching from API:', error.message);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

// Eksport dla Vercel
module.exports = app;

process.on('exit', () => redisClient.quit());