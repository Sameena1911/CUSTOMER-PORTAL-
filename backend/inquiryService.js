const express = require('express');
const axios = require('axios');
const { parseString } = require('xml2js');

const router = express.Router();

// Get customer inquiry data
router.get('/inquiries/:cust_id', async (req, res) => {
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
      <n0:ZCUST_INQUIRY_FM>
        <IV_KUNNR>${cust_id}</IV_KUNNR>
      </n0:ZCUST_INQUIRY_FM>
    </soapenv:Body>
  </soapenv:Envelope>`;

  try {
    console.log(`Attempting to get SAP inquiry data for customer: ${cust_id}`);
    
    const response = await axios.post(
      'http://AZKTLDS5CP.kcloud.com:8000/sap/bc/srt/scs/sap/zcust_inquiry_service?sap-client=100',
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

    console.log('SAP inquiry response received');

    parseString(response.data, (err, result) => {
      if (err) {
        console.error('SOAP Parsing Error:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Error parsing SAP response' 
        });
      }
      
      console.log('SAP inquiry response parsed successfully:', JSON.stringify(result, null, 2));
      
      // Parse the inquiry response
      try {
        const envelope = result['soap-env:Envelope'] || result['soapenv:Envelope'];
        const body = envelope['soap-env:Body'] || envelope['soapenv:Body'];
        const sapResponse = body && body[0] && (body[0]['n0:ZCUST_INQUIRY_FMResponse'] || body[0]['ns0:ZCUST_INQUIRY_FMResponse']);
        
        if (sapResponse && sapResponse[0]) {
          // Extract inquiry data from ET_INQUIRIES table
          const etInquiries = sapResponse[0]['ET_INQUIRIES'];
          let inquiryData = [];
          
          if (etInquiries && etInquiries[0] && etInquiries[0]['item']) {
            const items = Array.isArray(etInquiries[0]['item']) ? etInquiries[0]['item'] : [etInquiries[0]['item']];
            
            inquiryData = items.map(item => ({
              vbeln: item['VBELN'] ? item['VBELN'][0] : 'N/A',        // Sales Document
              ernam: item['ERNAM'] ? item['ERNAM'][0] : 'N/A',        // Created By
              kunnr: item['KUNNR'] ? item['KUNNR'][0] : 'N/A',        // Customer Number
              erdat: item['ERDAT'] ? item['ERDAT'][0] : 'N/A',        // Created Date
              auart: item['AUART'] ? item['AUART'][0] : 'N/A',        // Document Type
              netwr: item['NETWR'] ? parseFloat(item['NETWR'][0]) : 0, // Net Value
              knumv: item['KNUMV'] ? item['KNUMV'][0] : 'N/A'         // Number of Document Condition
            }));
          }
          
          res.json({ 
            success: true, 
            message: `Found ${inquiryData.length} inquiry records for customer ${cust_id}`,
            inquiries: inquiryData,
            totalCount: inquiryData.length,
            customerId: cust_id,
            sapResponse: result 
          });
        } else {
          res.status(404).json({ 
            success: false, 
            message: 'No inquiry data found for this customer',
            sapResponse: result 
          });
        }
      } catch (parseError) {
        console.error('Error parsing SAP inquiry response structure:', parseError);
        res.status(500).json({ 
          success: false, 
          message: 'Error processing inquiry data',
          sapResponse: result 
        });
      }
    });

  } catch (error) {
    console.error('SAP inquiry request failed:', error.message);
    
    if (error.response) {
      console.error('SAP Error Response:', error.response.status, error.response.data);
      
      if (error.response.status === 401) {
        res.status(401).json({ 
          success: false, 
          message: 'SAP authentication failed for inquiry service' 
        });
      } else if (error.response.status === 500) {
        // SAP returned a SOAP fault - try to parse it for useful information
        console.log('SAP returned SOAP fault, checking for details...');
        
        if (error.response.data && error.response.data.includes('faultstring')) {
          const faultMatch = error.response.data.match(/<faultstring[^>]*>(.*?)<\/faultstring>/);
          const faultReason = faultMatch ? faultMatch[1] : 'Unknown SOAP fault';
          
          res.status(500).json({ 
            success: false, 
            message: `SAP Inquiry Service Error: ${faultReason}. Customer ID: ${cust_id}. 
            
DIAGNOSIS: The function module 'ZCUST_INQUIRY_FM' exists in SAP but may not be properly exposed through the web service 'zcust_inquiry_service'. 

SOAP REQUEST SENT:
${soapEnvelope}

POSSIBLE SOLUTIONS:
1. Check if ZCUST_INQUIRY_FM is bound to the web service 'zcust_inquiry_service'
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
            message: `SAP inquiry service returned error 500 for customer ID: ${cust_id}. The function module might not be exposed through this web service.` 
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
        message: 'Cannot connect to SAP inquiry service' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error in inquiry service' 
      });
    }
  }
});

// POST method for inquiry data (alternative endpoint)
router.post('/inquiries', async (req, res) => {
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
      <n0:ZCUST_INQUIRY_FM>
        <IV_KUNNR>${cust_id}</IV_KUNNR>
      </n0:ZCUST_INQUIRY_FM>
    </soapenv:Body>
  </soapenv:Envelope>`;

  try {
    console.log(`Attempting to get SAP inquiry data for customer: ${cust_id}`);
    
    const response = await axios.post(
      'http://AZKTLDS5CP.kcloud.com:8000/sap/bc/srt/scs/sap/zcust_inquiry_service?sap-client=100',
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

    console.log('SAP inquiry response received');

    parseString(response.data, (err, result) => {
      if (err) {
        console.error('SOAP Parsing Error:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Error parsing SAP response' 
        });
      }
      
      console.log('SAP inquiry response parsed successfully:', JSON.stringify(result, null, 2));
      
      // Parse the inquiry response
      try {
        const envelope = result['soap-env:Envelope'] || result['soapenv:Envelope'];
        const body = envelope['soap-env:Body'] || envelope['soapenv:Body'];
        const sapResponse = body && body[0] && (body[0]['n0:ZCUST_INQUIRY_FMResponse'] || body[0]['ns0:ZCUST_INQUIRY_FMResponse']);
        
        if (sapResponse && sapResponse[0]) {
          // Extract inquiry data from ET_INQUIRIES table
          const etInquiries = sapResponse[0]['ET_INQUIRIES'];
          let inquiryData = [];
          
          if (etInquiries && etInquiries[0] && etInquiries[0]['item']) {
            const items = Array.isArray(etInquiries[0]['item']) ? etInquiries[0]['item'] : [etInquiries[0]['item']];
            
            inquiryData = items.map(item => ({
              vbeln: item['VBELN'] ? item['VBELN'][0] : 'N/A',        // Sales Document
              ernam: item['ERNAM'] ? item['ERNAM'][0] : 'N/A',        // Created By
              kunnr: item['KUNNR'] ? item['KUNNR'][0] : 'N/A',        // Customer Number
              erdat: item['ERDAT'] ? formatSapDate(item['ERDAT'][0]) : 'N/A', // Created Date (formatted)
              auart: item['AUART'] ? item['AUART'][0] : 'N/A',        // Document Type
              netwr: item['NETWR'] ? parseFloat(item['NETWR'][0]).toFixed(2) : '0.00', // Net Value (formatted)
              knumv: item['KNUMV'] ? item['KNUMV'][0] : 'N/A'         // Number of Document Condition
            }));
          }
          
          res.json({ 
            success: true, 
            message: `Found ${inquiryData.length} inquiry records for customer ${cust_id}`,
            inquiries: inquiryData,
            totalCount: inquiryData.length,
            customerId: cust_id,
            sapResponse: result 
          });
        } else {
          res.json({ 
            success: false, 
            message: 'No inquiry data found for this customer',
            sapResponse: result 
          });
        }
      } catch (parseError) {
        console.error('Error parsing SAP inquiry response structure:', parseError);
        res.status(500).json({ 
          success: false, 
          message: 'Error processing inquiry data' 
        });
      }
    });

  } catch (error) {
    console.error('SAP inquiry request failed:', error.message);
    
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

// Helper function to format SAP date
function formatSapDate(sapDate) {
  if (!sapDate || sapDate === '00000000') return 'N/A';
  
  // SAP date format is YYYYMMDD
  const year = sapDate.substring(0, 4);
  const month = sapDate.substring(4, 6);
  const day = sapDate.substring(6, 8);
  
  return `${day}/${month}/${year}`;
}

module.exports = router;
