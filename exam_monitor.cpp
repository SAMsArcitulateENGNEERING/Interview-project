#include <windows.h>
#include <iostream>
#include <string>
#include <chrono>
#include <thread>
#include <curl/curl.h>
#include <json/json.h>

class ExamMonitor {
private:
    static ExamMonitor* instance;
    HHOOK keyboardHook;
    HHOOK mouseHook;
    int violationCount;
    long long lastViolationTime;
    std::string currentAttemptId;
    bool isMonitoring;
    std::string serverUrl;
    
    // Windows API callback functions
    static LRESULT CALLBACK KeyboardProc(int nCode, WPARAM wParam, LPARAM lParam);
    static LRESULT CALLBACK MouseProc(int nCode, WPARAM wParam, LPARAM lParam);
    static LRESULT CALLBACK WindowProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARAM lParam);
    
    // HTTP request helper
    static size_t WriteCallback(void* contents, size_t size, size_t nmemb, std::string* userp);
    bool sendViolationToServer(const std::string& reason);
    
    // Violation handling
    void handleViolation(const std::string& reason);
    void handleExamTermination();
    
    // System monitoring
    void checkForSuspiciousActivity();
    void startPeriodicCheck();
    
public:
    ExamMonitor();
    ~ExamMonitor();
    
    void startMonitoring(const std::string& attemptId);
    void stopMonitoring();
    void run();
    
    // Getters
    bool getIsMonitoring() const { return isMonitoring; }
    int getViolationCount() const { return violationCount; }
};

// Static instance
ExamMonitor* ExamMonitor::instance = nullptr;

ExamMonitor::ExamMonitor() 
    : keyboardHook(nullptr), mouseHook(nullptr), violationCount(0), 
      lastViolationTime(0), isMonitoring(false), serverUrl("http://127.0.0.1:8000") {
    instance = this;
    
    // Initialize CURL
    curl_global_init(CURL_GLOBAL_ALL);
    
    std::cout << "Exam Monitor initialized" << std::endl;
    std::cout << "Server URL: " << serverUrl << std::endl;
}

ExamMonitor::~ExamMonitor() {
    if (keyboardHook) {
        UnhookWindowsHookEx(keyboardHook);
    }
    if (mouseHook) {
        UnhookWindowsHookEx(mouseHook);
    }
    curl_global_cleanup();
}

LRESULT CALLBACK ExamMonitor::KeyboardProc(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode >= 0 && instance && instance->getIsMonitoring()) {
        if (wParam == WM_KEYDOWN) {
            KBDLLHOOKSTRUCT* kbStruct = (KBDLLHOOKSTRUCT*)lParam;
            
            // Check for Alt+Tab, Ctrl+Tab, F11, F12, etc.
            bool isAltPressed = GetAsyncKeyState(VK_MENU) & 0x8000;
            bool isCtrlPressed = GetAsyncKeyState(VK_CONTROL) & 0x8000;
            
            if ((kbStruct->vkCode == VK_TAB && (isAltPressed || isCtrlPressed)) ||
                kbStruct->vkCode == VK_F11 || kbStruct->vkCode == VK_F12 ||
                kbStruct->vkCode == VK_ESCAPE) {
                
                std::string reason = "Suspicious key combination detected: ";
                if (isAltPressed) reason += "Alt+";
                if (isCtrlPressed) reason += "Ctrl+";
                
                switch (kbStruct->vkCode) {
                    case VK_TAB: reason += "Tab"; break;
                    case VK_F11: reason += "F11"; break;
                    case VK_F12: reason += "F12"; break;
                    case VK_ESCAPE: reason += "Escape"; break;
                }
                
                instance->handleViolation(reason);
            }
        }
    }
    return CallNextHookEx(nullptr, nCode, wParam, lParam);
}

LRESULT CALLBACK ExamMonitor::MouseProc(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode >= 0 && instance && instance->getIsMonitoring()) {
        // Monitor mouse activity for suspicious behavior
        // This could detect mouse leaving the exam window area
    }
    return CallNextHookEx(nullptr, nCode, wParam, lParam);
}

LRESULT CALLBACK ExamMonitor::WindowProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARAM lParam) {
    if (instance && instance->getIsMonitoring()) {
        switch (uMsg) {
            case WM_ACTIVATE:
                if (LOWORD(wParam) == WA_INACTIVE) {
                    instance->handleViolation("Window focus lost");
                }
                break;
            case WM_SIZE:
                if (wParam == SIZE_MINIMIZED) {
                    instance->handleViolation("Window minimized");
                }
                break;
        }
    }
    return DefWindowProc(hwnd, uMsg, wParam, lParam);
}

size_t ExamMonitor::WriteCallback(void* contents, size_t size, size_t nmemb, std::string* userp) {
    userp->append((char*)contents, size * nmemb);
    return size * nmemb;
}

bool ExamMonitor::sendViolationToServer(const std::string& reason) {
    if (currentAttemptId.empty()) return false;
    
    CURL* curl = curl_easy_init();
    if (!curl) return false;
    
    std::string postData = "attempt_id=" + currentAttemptId;
    std::string response;
    
    curl_easy_setopt(curl, CURLOPT_URL, (serverUrl + "/increment_alt_tab").c_str());
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, postData.c_str());
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 5L);
    
    CURLcode res = curl_easy_perform(curl);
    long http_code = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &http_code);
    
    curl_easy_cleanup(curl);
    
    if (res == CURLE_OK && http_code == 200) {
        std::cout << "Violation sent to server successfully" << std::endl;
        return true;
    } else {
        std::cerr << "Failed to send violation to server. HTTP code: " << http_code << std::endl;
        return false;
    }
}

void ExamMonitor::handleViolation(const std::string& reason) {
    auto now = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();
    
    // Debounce rapid violations (2 seconds)
    if (now - lastViolationTime < 2000) {
        return;
    }
    
    lastViolationTime = now;
    violationCount++;
    
    std::cout << "VIOLATION DETECTED: " << reason 
              << " (Count: " << violationCount << "/3)" << std::endl;
    
    // Show system notification
    MessageBoxA(nullptr, 
        ("Violation #" + std::to_string(violationCount) + ": " + reason).c_str(),
        "Exam Violation", 
        violationCount >= 3 ? MB_ICONERROR : MB_ICONWARNING);
    
    // Send to server
    sendViolationToServer(reason);
    
    if (violationCount >= 3) {
        handleExamTermination();
    }
}

void ExamMonitor::handleExamTermination() {
    std::cout << "EXAM TERMINATED - Maximum violations reached!" << std::endl;
    
    MessageBoxA(nullptr, 
        "Exam terminated due to multiple violations!", 
        "Exam Terminated", 
        MB_ICONERROR);
    
    // Open results page in default browser
    ShellExecuteA(nullptr, "open", (serverUrl + "/results.html").c_str(), 
                  nullptr, nullptr, SW_SHOWNORMAL);
    
    stopMonitoring();
}

void ExamMonitor::checkForSuspiciousActivity() {
    // Check for minimized windows
    HWND foregroundWindow = GetForegroundWindow();
    if (foregroundWindow && IsIconic(foregroundWindow)) {
        handleViolation("Active window minimized");
    }
    
    // Check for extended inactivity (simplified)
    // In a real implementation, you'd track mouse/keyboard activity
}

void ExamMonitor::startPeriodicCheck() {
    std::thread([this]() {
        while (isMonitoring) {
            std::this_thread::sleep_for(std::chrono::seconds(5));
            if (isMonitoring) {
                checkForSuspiciousActivity();
            }
        }
    }).detach();
}

void ExamMonitor::startMonitoring(const std::string& attemptId) {
    currentAttemptId = attemptId;
    isMonitoring = true;
    violationCount = 0;
    
    std::cout << "Started monitoring for attempt ID: " << attemptId << std::endl;
    
    // Install hooks
    keyboardHook = SetWindowsHookEx(WH_KEYBOARD_LL, KeyboardProc, nullptr, 0);
    mouseHook = SetWindowsHookEx(WH_MOUSE_LL, MouseProc, nullptr, 0);
    
    if (!keyboardHook) {
        std::cerr << "Failed to install keyboard hook" << std::endl;
    }
    if (!mouseHook) {
        std::cerr << "Failed to install mouse hook" << std::endl;
    }
    
    startPeriodicCheck();
    
    MessageBoxA(nullptr, 
        ("Monitoring active for attempt " + attemptId).c_str(),
        "Exam Started", 
        MB_ICONINFORMATION);
}

void ExamMonitor::stopMonitoring() {
    isMonitoring = false;
    currentAttemptId.clear();
    
    if (keyboardHook) {
        UnhookWindowsHookEx(keyboardHook);
        keyboardHook = nullptr;
    }
    if (mouseHook) {
        UnhookWindowsHookEx(mouseHook);
        mouseHook = nullptr;
    }
    
    std::cout << "Stopped monitoring" << std::endl;
}

void ExamMonitor::run() {
    // Message loop
    MSG msg;
    while (GetMessage(&msg, nullptr, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
}

int main(int argc, char* argv[]) {
    std::cout << "Starting Exam Monitor (C++)..." << std::endl;
    
    ExamMonitor monitor;
    
    // For testing, start monitoring with a dummy attempt ID
    if (argc > 1) {
        monitor.startMonitoring(argv[1]);
    } else {
        monitor.startMonitoring("test_attempt_123");
    }
    
    // Run the message loop
    monitor.run();
    
    return 0;
} 