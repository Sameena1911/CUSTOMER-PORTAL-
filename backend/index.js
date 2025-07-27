const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { parseString } = require('xml2js');

// Import services
const profileService = require('./profileService');
const inquiryService = require('./inquiryService');
const salesOrderService = require('./salesOrderService');
const deliveryService = require('./deliveryService');
const financialService = require('./financialService');
const paymentAgingService = require('./paymentAgingService');
const memoService = require('./memoService');
const overallSalesService = require('./overallSalesService');
const invoiceService = require('./invoiceService');

const app = express();

// CORS middleware to allow Angular frontend to call the API
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // Allow all origins for development
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(bodyParser.json());

// Use service routes
app.use('/api/customer', profileService);
app.use('/api/customer', inquiryService);
app.use('/api/customer', salesOrderService);
app.use('/api/customer', deliveryService);
app.use('/api/customer', financialService);
app.use('/api/customer', paymentAgingService);
app.use('/api/customer', memoService);
app.use('/api/customer', overallSalesService);
app.use('/api/customer', invoiceService);

app.post('/api/login', async (req, res) => {
  const { cust_id, password } = req.body;

  // Validate input
  if (!cust_id || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Customer ID and password are required' 
    });
  }

  console.log(`Login attempt for customer: ${cust_id}`);

  // FOR DEVELOPMENT: Use mock authentication first, then try SAP
  // Allow common test credentials for development
  const validTestCredentials = [
    { cust_id: '0000000001', password: '123456' },
    { cust_id: 'test', password: 'test' },
    { cust_id: '1000', password: 'pass' }
  ];

  const isValidTestCredential = validTestCredentials.some(
    cred => cred.cust_id === cust_id && cred.password === password
  );

  if (isValidTestCredential) {
    console.log('Mock authentication successful for testing');
    return res.json({ 
      success: true, 
      message: 'Login successful (mock authentication for development)',
      sapResponse: { mock: true }
    });
  }

  // If not a test credential, try SAP authentication
  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                    xmlns:urn="urn:sap-com:document:sap:rfc:functions">
    <soapenv:Header/>
    <soapenv:Body>
      <urn:ZCUST_PORTAL_FM>
        <CUST_ID>${cust_id}</CUST_ID>
        <PASSWORD>${password}</PASSWORD>
      </urn:ZCUST_PORTAL_FM>
    </soapenv:Body>
  </soapenv:Envelope>`;

  try {
    console.log(`Attempting SAP login for customer: ${cust_id}`);
    
    const response = await axios.post(
      'http://AZKTLDS5CP.kcloud.com:8000/sap/bc/srt/scs/sap/zservice_sam?sap-client=100',
      soapEnvelope,
      {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': '' // Add if required by your SAP service
        },
        auth: {
          username: 'K901705', // SAP system user from your Postman
          password: 'Sameena@1911'  // SAP system password from your Postman
        },
        timeout: 10000 // 10 seconds timeout (reduced for development)
      }
    );

    console.log('SAP response received');

    parseString(response.data, (err, result) => {
      if (err) {
        console.error('SOAP Parsing Error:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Error parsing SAP response' 
        });
      }
      
      console.log('SAP response parsed successfully:', JSON.stringify(result, null, 2));
      
      // Check if the response indicates success
      try {
        const envelope = result['soap-env:Envelope'] || result['soapenv:Envelope'];
        const body = envelope['soap-env:Body'] || envelope['soapenv:Body'];
        const sapResponse = body && body[0] && (body[0]['n0:ZCUST_PORTAL_FMResponse'] || body[0]['ns0:ZCUST_PORTAL_FMResponse']);
        
        if (sapResponse && sapResponse[0]) {
          const message = sapResponse[0]['MESSAGE'] && sapResponse[0]['MESSAGE'][0];
          const success = sapResponse[0]['SUCCESS'] && sapResponse[0]['SUCCESS'][0];
          
          console.log('SAP Response - Message:', message, 'Success:', success);
          
          if (success === 'X' || (message && message.toLowerCase().includes('successful'))) {
            res.json({ 
              success: true, 
              message: message || 'Login successful',
              sapResponse: result 
            });
          } else {
            res.json({ 
              success: false, 
              message: message || 'Login failed',
              sapResponse: result 
            });
          }
        } else {
          // Fallback - assume success if we got a valid SOAP response
          res.json({ 
            success: true, 
            message: 'Login successful',
            sapResponse: result 
          });
        }
      } catch (parseError) {
        console.error('Error parsing SAP response structure:', parseError);
        // Fallback - return the raw response
        res.json({ 
          success: true, 
          message: 'Login successful - response received from SAP',
          sapResponse: result 
        });
      }
    });

  } catch (error) {
    console.error('SAP request failed:', error.message);
    
    // For development, provide fallback authentication
    console.log('SAP connection failed, using fallback authentication for development');
    res.json({ 
      success: true, 
      message: 'Login successful (fallback authentication - SAP unavailable)',
      sapResponse: { fallback: true, error: error.message }
    });
  }
});

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
