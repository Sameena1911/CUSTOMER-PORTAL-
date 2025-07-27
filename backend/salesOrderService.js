const express = require('express');
const axios = require('axios');
const { parseString } = require('xml2js');

const router = express.Router();

// Get customer sales order data
router.get('/sales-orders/:cust_id', async (req, res) => {
  const { cust_id } = req.params;
  
  // Validate input
  if (!cust_id) {
    return res.status(400).json({ 
      success: false, 
      message: 'Customer ID is required' 
    });
  }

  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                    xmlns:n0="urn:sap-com:document:sap:rfc:functions">
    <soapenv:Header/>
    <soapenv:Body>
      <n0:ZSO_FM>
        <I_KUNNR>${cust_id}</I_KUNNR>
      </n0:ZSO_FM>
    </soapenv:Body>
  </soapenv:Envelope>`;

  try {
    console.log(`Attempting to get SAP sales order data for customer: ${cust_id}`);
    
    const response = await axios.post(
      'http://AZKTLDS5CP.kcloud.com:8000/sap/bc/srt/scs/sap/zcust_so_service?sap-client=100',
      soapEnvelope,
      {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': ''
        },
        auth: {
          username: 'K901705',
          password: 'Sameena@1911'
        },
        timeout: 30000
      }
    );

    console.log('SAP sales order response received');

    parseString(response.data, (err, result) => {
      if (err) {
        console.error('SOAP Parsing Error:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Error parsing SAP response' 
        });
      }
      
      console.log('SAP sales order response parsed successfully:', JSON.stringify(result, null, 2));
      
      // Parse the sales order response
      try {
        const envelope = result['soap-env:Envelope'] || result['soapenv:Envelope'];
        const body = envelope['soap-env:Body'] || envelope['soapenv:Body'];
        const sapResponse = body && body[0] && (body[0]['n0:ZSO_FMResponse'] || body[0]['ns0:ZSO_FMResponse']);
        
        if (sapResponse && sapResponse[0]) {
          // Extract sales order data from T_SO_DATA table
          const tSoData = sapResponse[0]['T_SO_DATA'];
          let salesOrderData = [];
          
          if (tSoData && tSoData[0] && tSoData[0]['item']) {
            const items = Array.isArray(tSoData[0]['item']) ? tSoData[0]['item'] : [tSoData[0]['item']];
            
            salesOrderData = items.map(item => ({
              vbeln: item['VBELN'] ? item['VBELN'][0] : 'N/A',        // Sales Document
              auart: item['AUART'] ? item['AUART'][0] : 'N/A',        // Document Type
              vkorg: item['VKORG'] ? item['VKORG'][0] : 'N/A',        // Sales Organization
              vtweg: item['VTWEG'] ? item['VTWEG'][0] : 'N/A',        // Distribution Channel
              kunnr: item['KUNNR'] ? item['KUNNR'][0] : 'N/A',        // Customer Number
              vrkme: item['VRKME'] ? item['VRKME'][0] : 'N/A',        // Sales Unit
              arktx: item['ARKTX'] ? item['ARKTX'][0] : 'N/A'         // Material Description
            }));
          }
          
          res.json({ 
            success: true, 
            message: `Found ${salesOrderData.length} sales order records for customer ${cust_id}`,
            salesOrders: salesOrderData,
            totalCount: salesOrderData.length,
            customerId: cust_id,
            sapResponse: result 
          });
        } else {
          res.status(404).json({ 
            success: false, 
            message: 'No sales order data found for this customer',
            sapResponse: result 
          });
        }
      } catch (parseError) {
        console.error('Error parsing SAP sales order response structure:', parseError);
        res.status(500).json({ 
          success: false, 
          message: 'Error processing sales order data',
          sapResponse: result 
        });
      }
    });

  } catch (error) {
    console.error('SAP sales order request failed:', error.message);
    
    if (error.response) {
      console.error('SAP Error Response:', error.response.status, error.response.data);
      
      if (error.response.status === 401) {
        res.status(401).json({ 
          success: false, 
          message: 'SAP authentication failed for sales order service' 
        });
      } else if (error.response.status === 500) {
        // SAP returned a SOAP fault - try to parse it for useful information
        console.log('SAP returned SOAP fault, checking for details...');
        
        if (error.response.data && error.response.data.includes('faultstring')) {
          const faultMatch = error.response.data.match(/<faultstring[^>]*>(.*?)<\/faultstring>/);
          const faultReason = faultMatch ? faultMatch[1] : 'Unknown SOAP fault';
          
          res.status(500).json({ 
            success: false, 
            message: `SAP Sales Order Service Error: ${faultReason}. Customer ID: ${cust_id}. 
            
DIAGNOSIS: The function module 'ZSO_FM' exists in SAP but may not be properly exposed through the web service 'zcust_so_service'. 

SOAP REQUEST SENT:
${soapEnvelope}

POSSIBLE SOLUTIONS:
1. Check if ZSO_FM is bound to the web service 'zcust_so_service'
2. Verify the function module is activated and has proper authorization
3. Check if the web service configuration includes this function module
4. Test the function module directly in SAP using SE37

Please verify the service configuration in SAP.`,
            soapFault: faultReason,
            customerId: cust_id,
            soapRequest: soapEnvelope
          });
        } else {
          res.status(500).json({ 
            success: false, 
            message: `SAP sales order service returned error 500 for customer ID: ${cust_id}. The function module might not be exposed through this web service.` 
          });
        }
      } else {
        res.status(500).json({ 
          success: false, 
          message: `SAP server error: ${error.response.status}` 
        });
      }
    } else if (error.request) {
      res.status(500).json({ 
        success: false, 
        message: 'Cannot connect to SAP sales order service' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error in sales order service' 
      });
    }
  }
});

// POST method for sales order data (alternative endpoint)
router.post('/sales-orders', async (req, res) => {
  const { cust_id } = req.body;

  // Validate input
  if (!cust_id) {
    return res.status(400).json({ 
      success: false, 
      message: 'Customer ID is required' 
    });
  }

  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                    xmlns:n0="urn:sap-com:document:sap:rfc:functions">
    <soapenv:Header/>
    <soapenv:Body>
      <n0:ZSO_FM>
        <I_KUNNR>${cust_id}</I_KUNNR>
      </n0:ZSO_FM>
    </soapenv:Body>
  </soapenv:Envelope>`;

  try {
    console.log(`Attempting to get SAP sales order data for customer: ${cust_id}`);
    
    const response = await axios.post(
      'http://AZKTLDS5CP.kcloud.com:8000/sap/bc/srt/scs/sap/zcust_so_service?sap-client=100',
      soapEnvelope,
      {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': ''
        },
        auth: {
          username: 'K901705',
          password: 'Sameena@1911'
        },
        timeout: 30000
      }
    );

    console.log('SAP sales order response received');

    parseString(response.data, (err, result) => {
      if (err) {
        console.error('SOAP Parsing Error:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Error parsing SAP response' 
        });
      }
      
      console.log('SAP sales order response parsed successfully:', JSON.stringify(result, null, 2));
      
      // Parse the sales order response
      try {
        const envelope = result['soap-env:Envelope'] || result['soapenv:Envelope'];
        const body = envelope['soap-env:Body'] || envelope['soapenv:Body'];
        const sapResponse = body && body[0] && (body[0]['n0:ZSO_FMResponse'] || body[0]['ns0:ZSO_FMResponse']);
        
        if (sapResponse && sapResponse[0]) {
          // Extract sales order data from T_SO_DATA table
          const tSoData = sapResponse[0]['T_SO_DATA'];
          let salesOrderData = [];
          
          if (tSoData && tSoData[0] && tSoData[0]['item']) {
            const items = Array.isArray(tSoData[0]['item']) ? tSoData[0]['item'] : [tSoData[0]['item']];
            
            salesOrderData = items.map(item => ({
              vbeln: item['VBELN'] ? item['VBELN'][0] : 'N/A',        // Sales Document
              auart: item['AUART'] ? item['AUART'][0] : 'N/A',        // Document Type
              vkorg: item['VKORG'] ? item['VKORG'][0] : 'N/A',        // Sales Organization
              vtweg: item['VTWEG'] ? item['VTWEG'][0] : 'N/A',        // Distribution Channel
              kunnr: item['KUNNR'] ? item['KUNNR'][0] : 'N/A',        // Customer Number
              vrkme: item['VRKME'] ? item['VRKME'][0] : 'N/A',        // Sales Unit
              arktx: item['ARKTX'] ? item['ARKTX'][0] : 'N/A'         // Material Description
            }));
          }
          
          res.json({ 
            success: true, 
            message: `Found ${salesOrderData.length} sales order records for customer ${cust_id}`,
            salesOrders: salesOrderData,
            totalCount: salesOrderData.length,
            customerId: cust_id,
            sapResponse: result 
          });
        } else {
          res.json({ 
            success: false, 
            message: 'No sales order data found for this customer',
            sapResponse: result 
          });
        }
      } catch (parseError) {
        console.error('Error parsing SAP sales order response structure:', parseError);
        res.status(500).json({ 
          success: false, 
          message: 'Error processing sales order data' 
        });
      }
    });

  } catch (error) {
    console.error('SAP sales order request failed:', error.message);
    
    if (error.response) {
      console.error('SAP Error Response:', error.response.status, error.response.data);
      
      if (error.response.status === 401) {
        res.status(401).json({ 
          success: false, 
          message: 'SAP authentication failed. Please check SAP system credentials.' 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: `SAP server error: ${error.response.status}` 
        });
      }
    } else if (error.request) {
      console.error('Network error - no response from SAP');
      res.status(500).json({ 
        success: false, 
        message: 'Cannot connect to SAP server. Please check network connectivity.' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      });
    }
  }
});

module.exports = router;
