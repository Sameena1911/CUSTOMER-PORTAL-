const express = require('express');
const axios = require('axios');
const { parseString } = require('xml2js');

const router = express.Router();

// Get customer profile information via GET method (for testing)
router.get('/profile/:cust_id', async (req, res) => {
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
      <n0:ZFM_CUST_PROFILE_SAM>
        <IV_KUNNR>${cust_id}</IV_KUNNR>
      </n0:ZFM_CUST_PROFILE_SAM>
    </soapenv:Body>
  </soapenv:Envelope>`;

  try {
    console.log(`Attempting to get SAP profile for customer: ${cust_id}`);
    
    const response = await axios.post(
      'http://AZKTLDS5CP.kcloud.com:8000/sap/bc/srt/scs/sap/zservice_cust_profile?sap-client=100',
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

    console.log('SAP profile response received');

    parseString(response.data, (err, result) => {
      if (err) {
        console.error('SOAP Parsing Error:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Error parsing SAP response' 
        });
      }
      
      console.log('SAP profile response parsed successfully:', JSON.stringify(result, null, 2));
      
      // Parse the profile response
      try {
        const envelope = result['soap-env:Envelope'] || result['soapenv:Envelope'];
        const body = envelope['soap-env:Body'] || envelope['soapenv:Body'];
        const sapResponse = body && body[0] && (body[0]['n0:ZFM_CUST_PROFILE_SAMResponse'] || body[0]['ns0:ZFM_CUST_PROFILE_SAMResponse']);
        
        if (sapResponse && sapResponse[0]) {
          // Extract profile fields based on SAP function module export parameters
          const profileData = {
            kunnr: cust_id,
            name1: sapResponse[0]['EV_NAME1'] ? sapResponse[0]['EV_NAME1'][0] : '',
            stras: sapResponse[0]['EV_STRAS'] ? sapResponse[0]['EV_STRAS'][0] : '',
            ort01: sapResponse[0]['EV_ORT01'] ? sapResponse[0]['EV_ORT01'][0] : '',
            pstlz: sapResponse[0]['EV_PSTLZ'] ? sapResponse[0]['EV_PSTLZ'][0] : '',
            message: sapResponse[0]['MESSAGE'] ? sapResponse[0]['MESSAGE'][0] : '',
            
            // Legacy field mappings for backward compatibility
            custId: cust_id,
            customerName: sapResponse[0]['EV_NAME1'] ? sapResponse[0]['EV_NAME1'][0] : 'N/A',
            address: sapResponse[0]['EV_STRAS'] ? sapResponse[0]['EV_STRAS'][0] : 'N/A',
            city: sapResponse[0]['EV_ORT01'] ? sapResponse[0]['EV_ORT01'][0] : 'N/A',
            postalCode: sapResponse[0]['EV_PSTLZ'] ? sapResponse[0]['EV_PSTLZ'][0] : 'N/A',
            status: 'Active'
          };
          
          const responseMessage = sapResponse[0]['MESSAGE'] ? sapResponse[0]['MESSAGE'][0] : 'Profile retrieved successfully';
          
          res.json({ 
            success: true, 
            message: responseMessage,
            profile: profileData,
            sapResponse: result 
          });
        } else {
          res.status(404).json({ 
            success: false, 
            message: 'Customer profile not found',
            sapResponse: result 
          });
        }
      } catch (parseError) {
        console.error('Error parsing SAP profile response structure:', parseError);
        res.status(500).json({ 
          success: false, 
          message: 'Error processing profile data',
          sapResponse: result 
        });
      }
    });

  } catch (error) {
    console.error('SAP profile request failed:', error.message);
    
    if (error.response) {
      console.error('SAP Error Response:', error.response.status, error.response.data);
      
      if (error.response.status === 401) {
        res.status(401).json({ 
          success: false, 
          message: 'SAP authentication failed for profile service' 
        });
      } else if (error.response.status === 500) {
        // SAP returned a SOAP fault - try to parse it for useful information
        console.log('SAP returned SOAP fault, checking for details...');
        
        // Try to parse the SOAP fault for more information
        if (error.response.data && error.response.data.includes('faultstring')) {
          const faultMatch = error.response.data.match(/<faultstring[^>]*>(.*?)<\/faultstring>/);
          const faultReason = faultMatch ? faultMatch[1] : 'Unknown SOAP fault';
          
          res.status(500).json({ 
            success: false, 
            message: `SAP Profile Service Error: ${faultReason}. Customer ID: ${cust_id}. 
            
DIAGNOSIS: The function module 'ZFM_CUST_PROFILE_SAM' exists in SAP but is not properly exposed through the web service 'zservice_sam'. 

SOAP REQUEST SENT:
${soapEnvelope}

POSSIBLE SOLUTIONS:
1. Check if ZFM_CUST_PROFILE_SAM is bound to the web service 'zservice_sam'
2. Verify the function module is activated and has proper authorization
3. Check if the web service configuration includes this function module
4. Test the function module directly in SAP using SE37

Please share the exact SOAP request that worked for your XML screenshot so I can match it exactly.`,
            soapFault: faultReason,
            customerId: cust_id,
            soapRequest: soapEnvelope
          });
        } else {
          res.status(500).json({ 
            success: false, 
            message: `SAP profile service returned error 500 for customer ID: ${cust_id}. The function module might not be exposed through this web service.` 
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
        message: 'Cannot connect to SAP profile service' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error in profile service' 
      });
    }
  }
});

// Get customer profile information via POST method (original)
router.post('/profile', async (req, res) => {
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
      <n0:ZFM_CUST_PROFILE_SAM>
        <IV_KUNNR>${cust_id}</IV_KUNNR>
      </n0:ZFM_CUST_PROFILE_SAM>
    </soapenv:Body>
  </soapenv:Envelope>`;

  try {
    console.log(`Attempting to get SAP profile for customer: ${cust_id}`);
    
    const response = await axios.post(
      'http://AZKTLDS5CP.kcloud.com:8000/sap/bc/srt/scs/sap/zservice_cust_profile?sap-client=100',
      soapEnvelope,
      {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': ''
        },
        auth: {
          username: 'K901705', // SAP system user
          password: 'Sameena@1911'  // SAP system password
        },
        timeout: 30000 // 30 seconds timeout
      }
    );

    console.log('SAP profile response received');

    parseString(response.data, (err, result) => {
      if (err) {
        console.error('SOAP Parsing Error:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Error parsing SAP response' 
        });
      }
      
      console.log('SAP profile response parsed successfully:', JSON.stringify(result, null, 2));
      
      // Parse the customer profile response
      try {
        const envelope = result['soap-env:Envelope'] || result['soapenv:Envelope'];
        const body = envelope['soap-env:Body'] || envelope['soapenv:Body'];
        const sapResponse = body && body[0] && (body[0]['n0:ZFM_CUST_PROFILE_SAMResponse'] || body[0]['ns0:ZFM_CUST_PROFILE_SAMResponse']);
        
        if (sapResponse && sapResponse[0]) {
          const profileData = {
            kunnr: cust_id,
            name1: sapResponse[0]['EV_NAME1'] && sapResponse[0]['EV_NAME1'][0] || '',
            stras: sapResponse[0]['EV_STRAS'] && sapResponse[0]['EV_STRAS'][0] || '',
            ort01: sapResponse[0]['EV_ORT01'] && sapResponse[0]['EV_ORT01'][0] || '',
            pstlz: sapResponse[0]['EV_PSTLZ'] && sapResponse[0]['EV_PSTLZ'][0] || '',
            message: sapResponse[0]['MESSAGE'] && sapResponse[0]['MESSAGE'][0] || '',
            
            // Legacy field mappings for backward compatibility
            custId: cust_id,
            customerName: sapResponse[0]['EV_NAME1'] && sapResponse[0]['EV_NAME1'][0] || 'N/A',
            address: sapResponse[0]['EV_STRAS'] && sapResponse[0]['EV_STRAS'][0] || 'N/A',
            city: sapResponse[0]['EV_ORT01'] && sapResponse[0]['EV_ORT01'][0] || 'N/A',
            postalCode: sapResponse[0]['EV_PSTLZ'] && sapResponse[0]['EV_PSTLZ'][0] || 'N/A',
            status: 'Active'
          };
          
          console.log('Customer Profile Data:', profileData);
          
          // Check if we got valid profile data
          if (profileData.name1 && profileData.name1 !== '') {
            res.json({ 
              success: true, 
              message: profileData.message || 'Profile retrieved successfully',
              profile: profileData,
              sapResponse: result 
            });
          } else {
            res.json({ 
              success: false, 
              message: profileData.message || 'Customer profile not found',
              sapResponse: result 
            });
          }
        } else {
          res.json({ 
            success: false, 
            message: 'Invalid response format from SAP',
            sapResponse: result 
          });
        }
      } catch (parseError) {
        console.error('Error parsing SAP profile response structure:', parseError);
        res.status(500).json({ 
          success: false, 
          message: 'Error processing customer profile data' 
        });
      }
    });

  } catch (error) {
    console.error('SAP profile request failed:', error.message);
    
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
