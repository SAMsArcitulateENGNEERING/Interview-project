@echo off
echo Starting Java Exam Monitor...
echo.
echo This will monitor for alt-tab violations during exams.
echo The application will run in the system tray.
echo.
echo Press any key to start...
pause >nul

java ExamMonitor

echo.
echo Exam Monitor stopped.
pause 