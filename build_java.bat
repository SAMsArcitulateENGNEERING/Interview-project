@echo off
echo Building Java Exam Monitor...

REM Check if Java is installed
java -version >nul 2>&1
if errorlevel 1 (
    echo Error: Java is not installed or not in PATH
    echo Please install Java JDK 11 or later
    pause
    exit /b 1
)

REM Compile the Java application
echo Compiling ExamMonitor.java...
javac ExamMonitor.java

if errorlevel 1 (
    echo Compilation failed!
    pause
    exit /b 1
)

echo Compilation successful!
echo.
echo To run the monitor:
echo   java ExamMonitor [attempt_id]
echo.
echo Example:
echo   java ExamMonitor test_attempt_123
echo.

REM Ask if user wants to run it now
set /p run_now="Do you want to run the monitor now? (y/n): "
if /i "%run_now%"=="y" (
    echo Starting Exam Monitor...
    java ExamMonitor test_attempt_123
)

pause 