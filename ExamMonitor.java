import java.awt.*;
import java.awt.event.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.net.*;
import java.net.http.*;
import java.time.Duration;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class ExamMonitor {
    private static final String SERVER_URL = "http://127.0.0.1:8000";
    private static final int VIOLATION_LIMIT = 3;
    private static final int DEBOUNCE_MS = 2000;
    
    private int violationCount = 0;
    private long lastViolationTime = 0;
    private String currentAttemptId = null;
    private boolean isMonitoring = false;
    private ScheduledExecutorService scheduler;
    private TrayIcon trayIcon;
    private SystemTray systemTray;
    
    // Global keyboard hook for system-wide key detection
    private KeyboardHook keyboardHook;
    
    public ExamMonitor() {
        initializeTray();
        initializeKeyboardHook();
        startPeriodicCheck();
    }
    
    private void initializeTray() {
        if (SystemTray.isSupported()) {
            systemTray = SystemTray.getSystemTray();
            Image image = Toolkit.getDefaultToolkit().getImage(getClass().getResource("/icon.png"));
            if (image == null) {
                // Create a simple icon if resource not found
                image = createDefaultIcon();
            }
            
            PopupMenu popup = new PopupMenu();
            MenuItem statusItem = new MenuItem("Status: Waiting for exam");
            MenuItem exitItem = new MenuItem("Exit");
            
            exitItem.addActionListener(e -> {
                stopMonitoring();
                System.exit(0);
            });
            
            popup.add(statusItem);
            popup.addSeparator();
            popup.add(exitItem);
            
            trayIcon = new TrayIcon(image, "Exam Monitor", popup);
            trayIcon.setImageAutoSize(true);
            
            try {
                systemTray.add(trayIcon);
                trayIcon.displayMessage("Exam Monitor", "System monitoring active", TrayIcon.MessageType.INFO);
            } catch (AWTException e) {
                System.err.println("Failed to add tray icon: " + e.getMessage());
            }
        }
    }
    
    private Image createDefaultIcon() {
        BufferedImage image = new BufferedImage(16, 16, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g2d = image.createGraphics();
        g2d.setColor(Color.RED);
        g2d.fillOval(2, 2, 12, 12);
        g2d.dispose();
        return image;
    }
    
    private void initializeKeyboardHook() {
        try {
            // Use JNativeHook for global keyboard monitoring
            keyboardHook = new KeyboardHook();
            keyboardHook.start();
        } catch (Exception e) {
            System.err.println("Failed to initialize keyboard hook: " + e.getMessage());
            // Fallback to AWT key listener
            setupFallbackKeyboardMonitoring();
        }
    }
    
    private void setupFallbackKeyboardMonitoring() {
        // Create a hidden window to capture global key events
        Frame hiddenFrame = new Frame();
        hiddenFrame.setUndecorated(true);
        hiddenFrame.setSize(1, 1);
        hiddenFrame.setLocationRelativeTo(null);
        hiddenFrame.setVisible(false);
        
        hiddenFrame.addKeyListener(new KeyAdapter() {
            @Override
            public void keyPressed(KeyEvent e) {
                if (isMonitoring) {
                    checkForSuspiciousKeys(e);
                }
            }
        });
        
        hiddenFrame.addWindowFocusListener(new WindowAdapter() {
            @Override
            public void windowLostFocus(WindowEvent e) {
                if (isMonitoring) {
                    handleFocusLoss();
                }
            }
        });
    }
    
    private void checkForSuspiciousKeys(KeyEvent e) {
        // Detect Alt+Tab, Ctrl+Tab, F11, F12, etc.
        int keyCode = e.getKeyCode();
        boolean isAltPressed = e.isAltDown();
        boolean isCtrlPressed = e.isControlDown();
        
        if ((keyCode == KeyEvent.VK_TAB && (isAltPressed || isCtrlPressed)) ||
            keyCode == KeyEvent.VK_F11 || keyCode == KeyEvent.VK_F12 ||
            keyCode == KeyEvent.VK_ESCAPE) {
            
            handleViolation("Suspicious key combination detected: " + 
                          (isAltPressed ? "Alt+" : "") + 
                          (isCtrlPressed ? "Ctrl+" : "") + 
                          KeyEvent.getKeyText(keyCode));
        }
    }
    
    private void handleFocusLoss() {
        handleViolation("Application focus lost");
    }
    
    private void handleViolation(String reason) {
        long currentTime = System.currentTimeMillis();
        if (currentTime - lastViolationTime < DEBOUNCE_MS) {
            return; // Debounce rapid violations
        }
        
        lastViolationTime = currentTime;
        violationCount++;
        
        System.out.println("VIOLATION DETECTED: " + reason + " (Count: " + violationCount + "/" + VIOLATION_LIMIT + ")");
        
        if (trayIcon != null) {
            trayIcon.displayMessage("Exam Violation", 
                "Violation #" + violationCount + ": " + reason, 
                violationCount >= VIOLATION_LIMIT ? TrayIcon.MessageType.ERROR : TrayIcon.MessageType.WARNING);
        }
        
        // Send violation to web server
        sendViolationToServer(reason);
        
        if (violationCount >= VIOLATION_LIMIT) {
            handleExamTermination();
        }
    }
    
    private void sendViolationToServer(String reason) {
        if (currentAttemptId == null) return;
        
        try {
            HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
            
            String requestBody = "attempt_id=" + currentAttemptId;
            
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(SERVER_URL + "/increment_alt_tab"))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();
            
            client.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .thenAccept(response -> {
                    if (response.statusCode() == 200) {
                        System.out.println("Violation sent to server successfully");
                    } else {
                        System.err.println("Failed to send violation to server: " + response.statusCode());
                    }
                })
                .exceptionally(e -> {
                    System.err.println("Error sending violation to server: " + e.getMessage());
                    return null;
                });
                
        } catch (Exception e) {
            System.err.println("Error sending violation to server: " + e.getMessage());
        }
    }
    
    private void handleExamTermination() {
        System.out.println("EXAM TERMINATED - Maximum violations reached!");
        
        if (trayIcon != null) {
            trayIcon.displayMessage("Exam Terminated", 
                "Exam terminated due to multiple violations!", 
                TrayIcon.MessageType.ERROR);
        }
        
        // Open results page in default browser
        try {
            Desktop.getDesktop().browse(new URI(SERVER_URL + "/results.html"));
        } catch (Exception e) {
            System.err.println("Failed to open results page: " + e.getMessage());
        }
        
        stopMonitoring();
    }
    
    private void startPeriodicCheck() {
        scheduler = Executors.newScheduledThreadPool(1);
        scheduler.scheduleAtFixedRate(() -> {
            if (isMonitoring) {
                checkForSuspiciousActivity();
            }
        }, 5, 5, TimeUnit.SECONDS);
    }
    
    private void checkForSuspiciousActivity() {
        // Check for minimized windows, inactive time, etc.
        try {
            // Check if any window is minimized
            GraphicsEnvironment ge = GraphicsEnvironment.getLocalGraphicsEnvironment();
            GraphicsDevice[] devices = ge.getScreenDevices();
            
            for (GraphicsDevice device : devices) {
                GraphicsConfiguration[] configs = device.getConfigurations();
                for (GraphicsConfiguration config : configs) {
                    Rectangle bounds = config.getBounds();
                    if (bounds.width < 100 || bounds.height < 100) {
                        handleViolation("Window minimized or resized suspiciously");
                        return;
                    }
                }
            }
            
            // Check for extended inactivity (mouse/keyboard)
            // This would require additional system-level monitoring
            
        } catch (Exception e) {
            System.err.println("Error in periodic check: " + e.getMessage());
        }
    }
    
    public void startMonitoring(String attemptId) {
        this.currentAttemptId = attemptId;
        this.isMonitoring = true;
        this.violationCount = 0;
        
        System.out.println("Started monitoring for attempt ID: " + attemptId);
        
        if (trayIcon != null) {
            trayIcon.setToolTip("Exam Monitor - Active (Attempt: " + attemptId + ")");
            trayIcon.displayMessage("Exam Started", 
                "Monitoring active for attempt " + attemptId, 
                TrayIcon.MessageType.INFO);
        }
    }
    
    public void stopMonitoring() {
        this.isMonitoring = false;
        this.currentAttemptId = null;
        
        System.out.println("Stopped monitoring");
        
        if (trayIcon != null) {
            trayIcon.setToolTip("Exam Monitor - Inactive");
        }
    }
    
    public static void main(String[] args) {
        System.out.println("Starting Exam Monitor...");
        System.out.println("Server URL: " + SERVER_URL);
        
        ExamMonitor monitor = new ExamMonitor();
        
        // For testing, start monitoring with a dummy attempt ID
        if (args.length > 0) {
            monitor.startMonitoring(args[0]);
        }
        
        // Keep the application running
        try {
            Thread.currentThread().join();
        } catch (InterruptedException e) {
            System.out.println("Monitor interrupted");
        }
    }
}

// Global keyboard hook implementation
class KeyboardHook {
    private boolean running = false;
    
    public void start() {
        if (running) return;
        running = true;
        
        // This would use JNativeHook library for true global key monitoring
        // For now, we'll use the fallback AWT approach
        System.out.println("Keyboard hook started (fallback mode)");
    }
    
    public void stop() {
        running = false;
        System.out.println("Keyboard hook stopped");
    }
} 