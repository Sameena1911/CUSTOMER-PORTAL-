# Customer Portal - SAP Integration

A comprehensive customer portal with SAP backend integration for financial data management, including invoice generation, payment aging, and sales analytics.

## 🚀 Features

- **SAP Integration**: Real-time data retrieval from SAP backend
- **Invoice Management**: View and download invoice PDFs directly from SAP
- **Payment Aging**: Track payment statuses and aging analysis
- **Sales Analytics**: Comprehensive sales data visualization
- **Credit/Debit Memos**: Manage credit and debit memo transactions
- **Responsive Design**: Modern Angular frontend with responsive UI

## 🏗️ Architecture

### Frontend (Angular 17+)
- **Framework**: Angular with TypeScript
- **Styling**: Custom CSS with responsive design
- **HTTP Client**: Integration with backend APIs
- **PDF Handling**: Client-side PDF viewing and downloading

### Backend (Node.js/Express)
- **Runtime**: Node.js with Express framework
- **SAP Integration**: SOAP client for SAP web services
- **Data Processing**: XML parsing and data transformation
- **Authentication**: SAP user authentication

### SAP Integration
- **Web Service**: `zcust_invoice_service`
- **Function Modules**:
  - `ZCUST_PORTAL_PAYAGE_FM` - Payment aging data
  - `ZCUST_INVOICE_FM` - Invoice PDF generation
- **Authentication**: Basic authentication with SAP credentials

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- SAP system access with proper credentials
- Angular CLI (for development)

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/customer-portal.git
cd customer-portal
```

### 2. Backend Setup
```bash
cd backend
npm install
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```

## 🚀 Running the Application

### Start Backend Server
```bash
cd backend
npm start
# Server runs on http://localhost:3000
```

### Start Frontend Development Server
```bash
cd frontend
npm start
# Application runs on http://localhost:4200
```

### Start Both Services (Alternative)
```bash
# From project root
start-servers.bat
```

## 🔧 Configuration

### SAP Configuration
Update the SAP connection details in backend services:
- **SAP URL**: `http://AZKTLDS5CP.kcloud.com:8000/sap/bc/srt/scs/sap/zcust_invoice_service?sap-client=100`
- **Credentials**: Configure in backend service files

### Environment Variables
Create `.env` file in backend directory:
```env
SAP_URL=your_sap_url
SAP_USERNAME=your_username
SAP_PASSWORD=your_password
SAP_CLIENT=100
PORT=3000
```

## 📚 API Endpoints

### Customer Data
- `GET /api/customer/overall-sales/:customerId` - Overall sales data
- `GET /api/customer/payment-aging/:customerId` - Payment aging information
- `GET /api/customer/invoices/:customerId` - Invoice list
- `GET /api/customer/invoice-pdf/:customerId/:documentNumber` - Invoice PDF
- `GET /api/customer/memos/:customerId` - Credit/Debit memos

## 🎨 Features Overview

### Financial Dashboard
- **Sales Overview**: Comprehensive sales analytics with filtering
- **Invoice Management**: Real-time invoice data with PDF generation
- **Payment Tracking**: Aging analysis with status indicators
- **Memo Management**: Credit and debit memo tracking

### User Interface
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Tab Navigation**: Easy switching between different data views
- **Advanced Filtering**: Filter data by date, amount, status, etc.
- **Export Functionality**: Download invoices as PDF files

## 🔒 Security

- SAP authentication integration
- Secure SOAP communication
- Input validation and sanitization
- Error handling and logging

## 🛠️ Development

### Backend Development
```bash
cd backend
npm run dev  # With nodemon for auto-restart
```

### Frontend Development
```bash
cd frontend
ng serve  # With hot reload
```

### Building for Production
```bash
# Frontend build
cd frontend
ng build --prod

# Backend is ready for production deployment
```

## 📝 SAP Function Modules

### ZCUST_PORTAL_PAYAGE_FM
- **Purpose**: Retrieve payment aging data
- **Input**: Customer ID
- **Output**: Payment aging information with transaction details

### ZCUST_INVOICE_FM
- **Purpose**: Generate invoice PDFs
- **Input**: Customer ID, Document Number
- **Output**: Base64 encoded PDF data

## 🐛 Troubleshooting

### Common Issues

1. **SAP Connection Timeout**
   - Check SAP server availability
   - Verify credentials and client number

2. **PDF Generation Issues**
   - Ensure SAP function module is properly configured
   - Check document number validity

3. **CORS Issues**
   - Verify backend CORS configuration
   - Check frontend API base URL

## 📈 Future Enhancements

- [ ] Real-time notifications
- [ ] Advanced reporting features
- [ ] Multi-language support
- [ ] Enhanced security features
- [ ] Mobile app development
- [ ] API rate limiting
- [ ] Caching implementation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

- **Developer**: Sameena
- **SAP Integration**: Custom ABAP development
- **Frontend**: Angular TypeScript implementation
- **Backend**: Node.js Express server

## 📞 Support

For support and questions, please contact:
- Email: support@customerportal.com
- Issues: GitHub Issues page

---

**Note**: This project requires access to SAP system and proper authentication credentials for full functionality.
