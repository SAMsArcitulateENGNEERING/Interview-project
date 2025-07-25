# 🎓 Professional Exam System

A secure, monitored, and professional online examination platform built with FastAPI and modern web technologies.

## 🌟 Features

### For Exam Hosts:
- ✅ Create and manage exam sessions
- ✅ Real-time monitoring of participants
- ✅ Violation detection (alt-tab monitoring)
- ✅ Export results and analytics
- ✅ Professional dashboard interface

### For Exam Participants:
- ✅ Secure exam environment
- ✅ Real-time progress tracking
- ✅ Professional exam interface
- ✅ Instant results after completion
- ✅ Mobile-responsive design

### System Features:
- 🔐 JWT-based authentication
- 🛡️ Role-based access control
- 📊 Real-time analytics
- 🚨 Security monitoring
- 📱 Responsive design
- 🌐 Cross-platform compatibility

## 🚀 Quick Start

### Local Development:
```bash
# Clone the repository
git clone <your-repo-url>
cd professional-exam-system

# Install dependencies
pip install -r requirements.txt

# Run the server
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Online Deployment:
See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed deployment instructions.

**Recommended Platforms:**
- 🚂 [Railway](https://railway.app) - Easiest deployment
- 🎨 [Render](https://render.com) - Great free tier
- ⚡ [Heroku](https://heroku.com) - Classic choice

## 📁 Project Structure

```
professional-exam-system/
├── main.py              # FastAPI application
├── models.py            # Database models
├── schemas.py           # Pydantic schemas
├── auth.py              # Authentication logic
├── database.py          # Database configuration
├── requirements.txt     # Python dependencies
├── static/              # Frontend assets
│   ├── css/            # Stylesheets
│   ├── js/             # JavaScript files
│   └── *.html          # HTML pages
├── Procfile            # Deployment configuration
├── runtime.txt         # Python version
└── DEPLOYMENT_GUIDE.md # Deployment instructions
```

## 🔧 Configuration

### Environment Variables:
```bash
SECRET_KEY=your-super-secret-key-here
DATABASE_URL=your-database-url
```

### Database:
- **Development**: SQLite (automatic)
- **Production**: PostgreSQL (recommended)

## 🌐 API Endpoints

### Authentication:
- `POST /register_user` - User registration
- `POST /login` - User login
- `GET /me` - Get current user

### Exam Management:
- `POST /api/create_exam` - Create exam session
- `GET /api/active_exams` - List active exams
- `POST /api/exam/{exam_id}/start` - Start exam session

### Exam Taking:
- `GET /get_random_questions` - Get exam questions
- `POST /start_exam` - Start exam attempt
- `POST /submit_answer` - Submit answer
- `POST /end_exam` - End exam attempt

### Monitoring:
- `POST /increment_alt_tab` - Track violations
- `GET /api/stats` - Dashboard statistics
- `GET /api/participants` - Active participants

## 🛡️ Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt password encryption
- **Role-Based Access**: Host vs Participant permissions
- **Input Validation**: Pydantic schema validation
- **SQL Injection Protection**: SQLAlchemy ORM
- **CORS Protection**: Configurable cross-origin settings

## 📱 User Interface

### Pages:
- **Landing Page** (`/`) - Role selection and features
- **Login** (`/login.html`) - Authentication interface
- **Host Dashboard** (`/host.html`) - Exam management
- **Exam Interface** (`/exam.html`) - Taking exams
- **Results** (`/results.html`) - View results
- **API Documentation** (`/docs`) - Interactive API docs

## 🔄 Development

### Adding New Features:
1. Update database models in `models.py`
2. Create Pydantic schemas in `schemas.py`
3. Add API endpoints in `main.py`
4. Update frontend in `static/` directory
5. Test locally before deploying

### Database Migrations:
```bash
# The app automatically creates tables on startup
# For production, consider using Alembic for migrations
```

## 📊 Monitoring & Analytics

### Built-in Analytics:
- Real-time participant tracking
- Violation detection and reporting
- Exam completion rates
- Performance metrics
- User activity logs

### Custom Analytics:
Extend the system by adding custom endpoints for:
- Detailed performance reports
- Export functionality
- Advanced filtering
- Custom dashboards

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🆘 Support

For support and questions:
1. Check the [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
2. Review the API documentation at `/docs`
3. Check the logs for error messages
4. Ensure all environment variables are set correctly

---

**Built with ❤️ using FastAPI, SQLAlchemy, and modern web technologies**

**Your Professional Exam System is ready to serve users worldwide! 🌍**
