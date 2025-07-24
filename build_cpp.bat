@echo off
echo Building C++ Exam Monitor...

REM Check if Visual Studio or MinGW is available
where cl >nul 2>&1
if errorlevel 1 (
    where g++ >nul 2>&1
    if errorlevel 1 (
        echo Error: No C++ compiler found
        echo Please install Visual Studio or MinGW-w64
        echo.
        echo For Visual Studio:
        echo   - Install Visual Studio Community with C++ tools
        echo   - Run this script from "Developer Command Prompt"
        echo.
        echo For MinGW:
        echo   - Install MinGW-w64
        echo   - Add MinGW bin directory to PATH
        pause
        exit /b 1
    ) else (
        echo Using MinGW compiler...
        set COMPILER=g++
        set LIBS=-lcurl -ljsoncpp -lws2_32 -lwinmm
    )
) else (
    echo Using Visual Studio compiler...
    set COMPILER=cl
    set LIBS=libcurl.lib jsoncpp.lib ws2_32.lib winmm.lib
)

REM Compile the C++ application
echo Compiling exam_monitor.cpp...
%COMPILER% exam_monitor.cpp %LIBS% /Fe:exam_monitor.exe

if errorlevel 1 (
    echo Compilation failed!
    echo.
    echo Note: You may need to install libcurl and jsoncpp libraries
    echo.
    echo For MinGW:
    echo   pacman -S mingw-w64-x86_64-curl mingw-w64-x86_64-jsoncpp
    echo.
    echo For Visual Studio:
    echo   vcpkg install curl jsoncpp
    pause
    exit /b 1
)

echo Compilation successful!
echo.
echo To run the monitor:
echo   exam_monitor.exe [attempt_id]
echo.
echo Example:
echo   exam_monitor.exe test_attempt_123
echo.

REM Ask if user wants to run it now
set /p run_now="Do you want to run the monitor now? (y/n): "
if /i "%run_now%"=="y" (
    echo Starting Exam Monitor...
    exam_monitor.exe test_attempt_123
)

pause 