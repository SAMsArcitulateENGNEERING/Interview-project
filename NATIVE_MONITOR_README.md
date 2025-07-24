# 🚀 Native Alt-Tab Detection System

This project now includes **true system-level alt-tab detection** using native Java and C++ applications that run alongside the web interface.

## 🎯 Why Native Applications?

**Browser Limitations:**
- `visibilitychange` event is unreliable
- Cannot detect system-wide key combinations
- Limited by browser security restrictions
- Easy to bypass with developer tools

**Native Advantages:**
- ✅ **True system-level monitoring**
- ✅ **Bulletproof Alt+Tab detection**
- ✅ **Global keyboard hooks**
- ✅ **Window focus monitoring**
- ✅ **Cannot be bypassed by browser**

## 📁 Files Overview

### Java Version (Recommended)
- `ExamMonitor.java` - Main Java application
- `build_java.bat` - Windows build script

### C++ Version (Advanced)
- `exam_monitor.cpp` - Main C++ application
- `build_cpp.bat` - Windows build script

## 🛠️ Installation & Setup

### Option 1: Java Version (Easier)

1. **Install Java JDK 11+**
   ```bash
   # Download from: https://adoptium.net/
   ```

2. **Build and Run**
   ```bash
   # Windows
   build_java.bat
   
   # Or manually
   javac ExamMonitor.java
   java ExamMonitor test_attempt_123
   ```

### Option 2: C++ Version (More Robust)

1. **Install C++ Compiler**
   ```bash
   # Option A: Visual Studio Community
   # Download from: https://visualstudio.microsoft.com/
   
   # Option B: MinGW-w64
   # Download from: https://www.mingw-w64.org/
   ```

2. **Install Dependencies**
   ```bash
   # For MinGW (MSYS2)
   pacman -S mingw-w64-x86_64-curl mingw-w64-x86_64-jsoncpp
   
   # For Visual Studio
   vcpkg install curl jsoncpp
   ```

3. **Build and Run**
   ```bash
   # Windows
   build_cpp.bat
   
   # Or manually
   g++ exam_monitor.cpp -lcurl -ljsoncpp -lws2_32 -lwinmm -o exam_monitor.exe
   exam_monitor.exe test_attempt_123
   ```

## 🔧 How It Works

### System-Level Detection
1. **Global Keyboard Hooks** - Captures Alt+Tab, Ctrl+Tab, F11, F12, etc.
2. **Window Focus Monitoring** - Detects when exam window loses focus
3. **Mouse Activity Tracking** - Monitors suspicious mouse behavior
4. **Periodic System Checks** - Detects minimized windows, inactivity

### Integration with Web Interface
1. **Native app runs in background** during exam
2. **Detects violations** and sends to web server via HTTP
3. **Web interface updates** violation count in real-time
4. **Automatic exam termination** after 3 violations

## 🎮 Usage

### Starting the Monitor

```bash
# Start with specific attempt ID
java ExamMonitor attempt_123

# Or C++ version
exam_monitor.exe attempt_123
```

### During Exam
1. **Start web server**: `python -m uvicorn main:app --reload`
2. **Start native monitor**: `java ExamMonitor [attempt_id]`
3. **Begin exam** in browser
4. **Monitor runs in background** with system tray icon

### What Gets Detected
- ✅ **Alt+Tab** / **Ctrl+Tab** (100% reliable)
- ✅ **F11** / **F12** (fullscreen/dev tools)
- ✅ **Escape key** (common cheat attempt)
- ✅ **Window minimization**
- ✅ **Focus loss** (switching applications)
- ✅ **Extended inactivity**

## 🔒 Security Features

### Java Version
- System tray notifications
- HTTP communication with web server
- Debounced violation detection
- Automatic browser redirection

### C++ Version
- Windows API hooks (low-level)
- System message boxes
- Thread-safe monitoring
- Direct HTTP requests via libcurl

## 🚨 Testing the System

### Test Commands
```bash
# Start monitor
java ExamMonitor test_123

# Try these during exam:
# - Alt+Tab (should trigger violation)
# - Ctrl+Tab (should trigger violation)
# - F11 (should trigger violation)
# - Minimize window (should trigger violation)
```

### Expected Behavior
1. **1st violation**: Warning popup
2. **2nd violation**: Warning popup
3. **3rd violation**: Exam terminated, browser opens results

## 🔧 Configuration

### Server URL
Edit the `SERVER_URL` constant in both applications:
```java
// Java
private static final String SERVER_URL = "http://127.0.0.1:8000";

// C++
std::string serverUrl = "http://127.0.0.1:8000";
```

### Violation Limits
```java
// Java
private static final int VIOLATION_LIMIT = 3;

// C++
// Change the condition: if (violationCount >= 3)
```

### Debounce Time
```java
// Java
private static final int DEBOUNCE_MS = 2000; // 2 seconds

// C++
// Change: if (now - lastViolationTime < 2000)
```

## 🐛 Troubleshooting

### Java Issues
```bash
# Check Java version
java -version

# Recompile if needed
javac ExamMonitor.java

# Run with verbose output
java -Djava.util.logging.config.file=logging.properties ExamMonitor
```

### C++ Issues
```bash
# Check compiler
g++ --version
cl

# Install missing libraries
pacman -S mingw-w64-x86_64-curl mingw-w64-x86_64-jsoncpp

# Check Windows SDK
# Ensure Windows.h is available
```

### Common Problems
1. **"Permission denied"** - Run as Administrator
2. **"Library not found"** - Install missing dependencies
3. **"Hook failed"** - Check antivirus/firewall settings
4. **"Server connection failed"** - Ensure web server is running

## 🎯 Advantages Over Browser-Only

| Feature | Browser-Only | Native + Browser |
|---------|-------------|------------------|
| Alt+Tab Detection | ❌ Unreliable | ✅ 100% Reliable |
| System Shortcuts | ❌ Limited | ✅ Full Detection |
| Window Focus | ❌ Browser-only | ✅ System-wide |
| Bypass Resistance | ❌ Easy to bypass | ✅ Very difficult |
| Performance | ⚠️ Browser dependent | ✅ Native speed |
| Installation | ✅ No setup | ⚠️ Requires compilation |

## 🚀 Next Steps

1. **Choose your preferred version** (Java = easier, C++ = more robust)
2. **Install dependencies** and compile
3. **Test with the web interface**
4. **Deploy both applications** together

This hybrid approach gives you **enterprise-grade** alt-tab detection that's virtually impossible to bypass! 