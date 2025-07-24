#include <windows.h>
#include <wininet.h>
#include <iostream>
#include <string>
#include <thread>
#include <chrono>

#pragma comment(lib, "wininet.lib")

class ExamMonitor {
private:
    static const int VIOLATION_LIMIT = 3;
    static const int DEBOUNCE_MS = 2000;
    
    int violationCount = 0;
    long long lastViolationTime = 0;
    std::string currentAttemptId;
    bool isMonitoring = false;
    HHOOK keyboardHook = nullptr;
    HHOOK mouseHook = nullptr;
    
    static ExamMonitor* instance;
    
public:
    ExamMonitor() {
        instance = this;
    }
    
    ~ExamMonitor() {
        if (keyboardHook) UnhookWindowsHookEx(keyboardHook);
        if (mouseHook) UnhookWindowsHookEx(mouseHook);
    }
    
    bool startMonitoring(const std::string& attemptId) {
        if (isMonitoring) return false;
        
        currentAttemptId = attemptId;
        isMonitoring = true;
        violationCount = 0;
        
        // Install global hooks
        keyboardHook = SetWindowsHookEx(WH_KEYBOARD_LL, KeyboardProc, nullptr, 0);
        mouseHook = SetWindowsHookEx(WH_MOUSE_LL, MouseProc, nullptr, 0);
        
        if (!keyboardHook || !mouseHook) {
            MessageBoxA(nullptr, "Failed to install system hooks!", "Exam Monitor Error", MB_ICONERROR);
            return false;
        }
        
        MessageBoxA(nullptr, "Exam monitoring started!\nAlt+Tab violations will be detected.", 
                   "Exam Monitor", MB_ICONINFORMATION);
        
        return true;
    }
    
    void stopMonitoring() {
        isMonitoring = false;
        if (keyboardHook) {
            UnhookWindowsHookEx(keyboardHook);
            keyboardHook = nullptr;
        }
        if (mouseHook) {
            UnhookWindowsHookEx(mouseHook);
            mouseHook = nullptr;
        }
        MessageBoxA(nullptr, "Exam monitoring stopped.", "Exam Monitor", MB_ICONINFORMATION);
    }
    
private:
    static LRESULT CALLBACK KeyboardProc(int nCode, WPARAM wParam, LPARAM lParam) {
        if (nCode >= 0 && instance && instance->isMonitoring) {
            KBDLLHOOKSTRUCT* kbStruct = (KBDLLHOOKSTRUCT*)lParam;
            
            if (wParam == WM_KEYDOWN) {
                // Check for Alt+Tab
                if (kbStruct->vkCode == VK_TAB && (GetAsyncKeyState(VK_MENU) & 0x8000)) {
                    instance->handleViolation("Alt+Tab detected");
                }
                // Check for other suspicious keys
                else if (kbStruct->vkCode == VK_F1 || kbStruct->vkCode == VK_F2 || 
                         kbStruct->vkCode == VK_F3 || kbStruct->vkCode == VK_F4 ||
                         kbStruct->vkCode == VK_F5 || kbStruct->vkCode == VK_F6 ||
                         kbStruct->vkCode == VK_F7 || kbStruct->vkCode == VK_F8 ||
                         kbStruct->vkCode == VK_F9 || kbStruct->vkCode == VK_F10 ||
                         kbStruct->vkCode == VK_F11 || kbStruct->vkCode == VK_F12) {
                    instance->handleViolation("Function key pressed: F" + std::to_string(kbStruct->vkCode - VK_F1 + 1));
                }
            }
        }
        return CallNextHookEx(nullptr, nCode, wParam, lParam);
    }
    
    static LRESULT CALLBACK MouseProc(int nCode, WPARAM wParam, LPARAM lParam) {
        if (nCode >= 0 && instance && instance->isMonitoring) {
            // Check for right-click (context menu)
            if (wParam == WM_RBUTTONDOWN) {
                instance->handleViolation("Right-click detected");
            }
        }
        return CallNextHookEx(nullptr, nCode, wParam, lParam);
    }
    
    void handleViolation(const std::string& reason) {
        auto now = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()).count();
        
        // Debounce violations
        if (now - lastViolationTime < DEBOUNCE_MS) {
            return;
        }
        
        lastViolationTime = now;
        violationCount++;
        
        std::string message = "VIOLATION #" + std::to_string(violationCount) + ": " + reason;
        MessageBoxA(nullptr, message.c_str(), "Exam Monitor Warning", MB_ICONWARNING);
        
        // Send violation to server
        sendViolationToServer(reason);
        
        if (violationCount >= VIOLATION_LIMIT) {
            handleExamTermination();
        }
    }
    
    void sendViolationToServer(const std::string& reason) {
        HINTERNET hInternet = InternetOpenA("Exam Monitor", INTERNET_OPEN_TYPE_DIRECT, nullptr, nullptr, 0);
        if (!hInternet) return;
        
        HINTERNET hConnect = InternetConnectA(hInternet, "127.0.0.1", 8000, nullptr, nullptr, INTERNET_SERVICE_HTTP, 0, 0);
        if (!hConnect) {
            InternetCloseHandle(hInternet);
            return;
        }
        
        HINTERNET hRequest = HttpOpenRequestA(hConnect, "POST", "/increment_alt_tab", nullptr, nullptr, nullptr, 0, 0);
        if (!hRequest) {
            InternetCloseHandle(hConnect);
            InternetCloseHandle(hInternet);
            return;
        }
        
        // Send the request
        std::string postData = "attempt_id=" + currentAttemptId + "&reason=" + reason;
        HttpSendRequest(hRequest, nullptr, 0, (LPVOID)postData.c_str(), postData.length());
        
        InternetCloseHandle(hRequest);
        InternetCloseHandle(hConnect);
        InternetCloseHandle(hInternet);
    }
    
    void handleExamTermination() {
        MessageBoxA(nullptr, "EXAM TERMINATED!\nMaximum violations reached.", 
                   "Exam Monitor", MB_ICONERROR);
        
        // Send termination to server
        HINTERNET hInternet = InternetOpenA("Exam Monitor", INTERNET_OPEN_TYPE_DIRECT, nullptr, nullptr, 0);
        if (hInternet) {
            HINTERNET hConnect = InternetConnectA(hInternet, "127.0.0.1", 8000, nullptr, nullptr, INTERNET_SERVICE_HTTP, 0, 0);
            if (hConnect) {
                HINTERNET hRequest = HttpOpenRequestA(hConnect, "POST", "/end_exam", nullptr, nullptr, nullptr, 0, 0);
                if (hRequest) {
                    std::string postData = "attempt_id=" + currentAttemptId + "&reason=violation_limit_reached";
                    HttpSendRequest(hRequest, nullptr, 0, (LPVOID)postData.c_str(), postData.length());
                    InternetCloseHandle(hRequest);
                }
                InternetCloseHandle(hConnect);
            }
            InternetCloseHandle(hInternet);
        }
        
        stopMonitoring();
    }
};

ExamMonitor* ExamMonitor::instance = nullptr;

int main() {
    std::cout << "=== Exam Monitor (C++ Native) ===" << std::endl;
    std::cout << "Starting system-level monitoring..." << std::endl;
    
    ExamMonitor monitor;
    
    // For testing, start monitoring with a dummy attempt ID
    std::string attemptId = "test_attempt_001";
    if (monitor.startMonitoring(attemptId)) {
        std::cout << "Monitoring started for attempt: " << attemptId << std::endl;
        std::cout << "Press Ctrl+C to stop monitoring..." << std::endl;
        
        // Keep the application running
        while (true) {
            std::this_thread::sleep_for(std::chrono::seconds(1));
        }
    } else {
        std::cout << "Failed to start monitoring!" << std::endl;
        return 1;
    }
    
    return 0;
} 