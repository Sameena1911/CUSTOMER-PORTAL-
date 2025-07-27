const express = require('express');
const axios = require('axios');
const xml2js = require('xml2js');

const router = express.Router();

// SAP service configuration for delivery data
const SAP_CONFIG = {
  baseURL: 'http://AZKTLDS5CP.kcloud.com:8000',
  servicePath: '/sap/bc/srt/scs/sap/zdelivery_service?sap-client=100',
  username: 'K901705',
  password: 'Sameena@1911',
  timeout: 30000
};

// Helper function to create SOAP envelope for delivery data
function createDeliverySOAPEnvelope(customerId) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:sap-com:document:sap:rfc:functions">
  <soapenv:Header/>
  <soapenv:Body>
    <urn:ZCUST_DELIVERY_FM>
      <I_KUNNR>${customerId}</I_KUNNR>
    </urn:ZCUST_DELIVERY_FM>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// Helper function to parse delivery SOAP response
async function parseDeliverySOAPResponse(xmlResponse) {
  try {
    const parser = new xml2js.Parser({ 
      explicitArray: false, 
      ignoreAttrs: true,
      tagNameProcessors: [xml2js.processors.stripPrefix]
    });
    
    const result = await parser.parseStringPromise(xmlResponse);
    
    // Navigate to the delivery list in the SOAP response
    const deliveryResponse = result?.Envelope?.Body?.ZCUST_DELIVERY_FMResponse;
    
    if (!deliveryResponse) {
      console.log('No delivery response found in SOAP response');
      return [];
    }

    const deliveryList = deliveryResponse.E_DELIVERY_LIST;
    
    if (!deliveryList) {
      console.log('No delivery list found in response');
      return [];
    }

    // Handle both single item and array cases
    let deliveries = [];
    if (Array.isArray(deliveryList.item)) {
      deliveries = deliveryList.item;
    } else if (deliveryList.item) {
      deliveries = [deliveryList.item];
    } else {
      console.log('No delivery items found');
      return [];
    }

    // Map delivery data to our format
    return deliveries.map(delivery => ({
      vbeln: delivery.VBELN || 'N/A',           // Delivery Document
      erdat: delivery.ERDAT || 'N/A',           // Creation Date
      lfart: delivery.LFART || 'N/A',           // Delivery Type
      vstel: delivery.VSTEL || 'N/A',           // Shipping Point
      route: delivery.ROUTE || 'N/A',           // Route
      lfimg: delivery.LFIMG || '0',             // Delivered Quantity
      vrkme: delivery.VRKME || 'N/A',           // Sales Unit
      lgort: delivery.LGORT || 'N/A'            // Storage Location
    }));

  } catch (error) {
    console.error('Error parsing delivery SOAP response:', error);
    throw new Error('Failed to parse delivery response');
  }
}

// GET endpoint - Retrieve delivery data for a customer
router.get('/deliveries/:customerId', async (req, res) => {
  try {
    const customerId = req.params.customerId;
    
    console.log(`Fetching delivery data for customer: ${customerId}`);

    // Create SOAP envelope
    const soapEnvelope = createDeliverySOAPEnvelope(customerId);
    
    // Configure request
    const config = {
      method: 'post',
      url: SAP_CONFIG.baseURL + SAP_CONFIG.servicePath,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'urn:sap-com:document:sap:rfc:functions:ZCUST_DELIVERY_FM'
      },
      data: soapEnvelope,
      auth: {
        username: SAP_CONFIG.username,
        password: SAP_CONFIG.password
      },
      timeout: SAP_CONFIG.timeout
    };

    console.log('Sending delivery request to SAP...');

    // Make request to SAP
    const response = await axios(config);
    
    console.log('Received delivery response from SAP, status:', response.status);

    // Parse the response
    const deliveries = await parseDeliverySOAPResponse(response.data);
    
    console.log(`Parsed ${deliveries.length} delivery records`);

    // Return success response
    res.json({
      success: true,
      customerId: customerId,
      deliveries: deliveries,
      totalRecords: deliveries.length,
      message: deliveries.length > 0 ? 
        `Found ${deliveries.length} delivery records` : 
        'No delivery records found for this customer'
    });

  } catch (error) {
    console.error('Error fetching delivery data:', error);
    
    // Determine error type and message
    let errorMessage = 'Failed to fetch delivery data';
    let statusCode = 500;

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      errorMessage = 'Unable to connect to SAP system';
      statusCode = 503;
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Request timeout - SAP system not responding';
      statusCode = 504;
    } else if (error.response?.status === 401) {
      errorMessage = 'Authentication failed with SAP system';
      statusCode = 401;
    } else if (error.response?.status) {
      errorMessage = `SAP system error: ${error.response.status}`;
      statusCode = error.response.status;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: error.message,
      customerId: req.params.customerId
    });
  }
});

// POST endpoint - Alternative way to get delivery data with request body
router.post('/deliveries', async (req, res) => {
  try {
    const { customerId } = req.body;
    
    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID is required'
      });
    }

    console.log(`Fetching delivery data via POST for customer: ${customerId}`);

    // Create SOAP envelope
    const soapEnvelope = createDeliverySOAPEnvelope(customerId);
    
    // Configure request
    const config = {
      method: 'post',
      url: SAP_CONFIG.baseURL + SAP_CONFIG.servicePath,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'urn:sap-com:document:sap:rfc:functions:ZCUST_DELIVERY_FM'
      },
      data: soapEnvelope,
      auth: {
        username: SAP_CONFIG.username,
        password: SAP_CONFIG.password
      },
      timeout: SAP_CONFIG.timeout
    };

    console.log('Sending delivery POST request to SAP...');

    // Make request to SAP
    const response = await axios(config);
    
    console.log('Received delivery POST response from SAP, status:', response.status);

    // Parse the response
    const deliveries = await parseDeliverySOAPResponse(response.data);
    
    console.log(`Parsed ${deliveries.length} delivery records via POST`);

    // Return success response
    res.json({
      success: true,
      customerId: customerId,
      deliveries: deliveries,
      totalRecords: deliveries.length,
      message: deliveries.length > 0 ? 
        `Found ${deliveries.length} delivery records` : 
        'No delivery records found for this customer'
    });

  } catch (error) {
    console.error('Error fetching delivery data via POST:', error);
    
    // Determine error type and message
    let errorMessage = 'Failed to fetch delivery data';
    let statusCode = 500;

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      errorMessage = 'Unable to connect to SAP system';
      statusCode = 503;
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Request timeout - SAP system not responding';
      statusCode = 504;
    } else if (error.response?.status === 401) {
      errorMessage = 'Authentication failed with SAP system';
      statusCode = 401;
    } else if (error.response?.status) {
      errorMessage = `SAP system error: ${error.response.status}`;
      statusCode = error.response.status;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: error.message,
      customerId: req.body.customerId
    });
  }
});

// Test endpoint to verify service is working
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Delivery service is working',
    service: 'zdelivery_service',
    functionModule: 'ZCUST_DELIVERY_FM',
    endpoints: {
      getDeliveries: 'GET /api/customer/deliveries/:customerId',
      postDeliveries: 'POST /api/customer/deliveries'
    }
  });
});

module.exports = router;
