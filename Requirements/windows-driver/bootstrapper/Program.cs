using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Management;
using System.Net;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace NavBrahmi.Setup
{
    public class SetupConfig
    {
        public string LicenseKey { get; set; }
        public string AuthToken { get; set; }
        public string BackendUrl { get; set; }
        public string MachineOverride { get; set; }
        public bool Silent { get; set; }
        public bool AutoDetected { get; set; }

        public SetupConfig()
        {
            LicenseKey = "";
            AuthToken = "";
            BackendUrl = "https://client-driver-website.vercel.app";
            MachineOverride = "";
            Silent = false;
            AutoDetected = false;
        }
    }

    public class InstallerEngine
    {
        private const string PAYLOAD_INTEGRITY_SECRET = "navbrahmi-default-secure-purchase-token-signing-secret-2026";
        private SetupConfig _config;
        private Action<string> _logCallback;
        private Action<int, string> _progressCallback;

        public InstallerEngine(SetupConfig config, Action<string> logCallback, Action<int, string> progressCallback)
        {
            _config = config;
            _logCallback = logCallback ?? ((s) => { });
            _progressCallback = progressCallback ?? ((p, s) => { });
        }

        private void Log(string message)
        {
            _logCallback(message);
        }

        private void Progress(int percentage, string status)
        {
            _progressCallback(percentage, status);
        }

        public static bool IsAdministrator()
        {
            try
            {
                using (WindowsIdentity identity = WindowsIdentity.GetCurrent())
                {
                    WindowsPrincipal principal = new WindowsPrincipal(identity);
                    return principal.IsInRole(WindowsBuiltInRole.Administrator);
                }
            }
            catch
            {
                return false;
            }
        }

        public static string ExtractJsonString(string json, string key)
        {
            try
            {
                if (string.IsNullOrEmpty(json) || string.IsNullOrEmpty(key)) return "";
                int kIdx = json.IndexOf("\"" + key + "\"", StringComparison.OrdinalIgnoreCase);
                if (kIdx < 0) return "";
                int colonIdx = json.IndexOf(":", kIdx + key.Length + 2);
                if (colonIdx < 0) return "";
                int quoteStart = json.IndexOf("\"", colonIdx);
                if (quoteStart < 0) return "";
                int quoteEnd = json.IndexOf("\"", quoteStart + 1);
                if (quoteEnd <= quoteStart) return "";
                return json.Substring(quoteStart + 1, quoteEnd - quoteStart - 1).Replace("\\/", "/").Trim();
            }
            catch
            {
                return "";
            }
        }

        public static string ExtractJsonRaw(string json, string key)
        {
            try
            {
                if (string.IsNullOrEmpty(json) || string.IsNullOrEmpty(key)) return "";
                int kIdx = json.IndexOf("\"" + key + "\"", StringComparison.OrdinalIgnoreCase);
                if (kIdx < 0) return "";
                int colonIdx = json.IndexOf(":", kIdx + key.Length + 2);
                if (colonIdx < 0) return "";
                int endIdx = json.IndexOfAny(new char[] { ',', '}' }, colonIdx + 1);
                if (endIdx < 0) endIdx = json.Length;
                string val = json.Substring(colonIdx + 1, endIdx - colonIdx - 1).Trim().Trim('\"');
                return val;
            }
            catch
            {
                return "";
            }
        }

        public static bool VerifyPayloadSignature(string backendUrl, string licenseKey, string token, string generatedAt, string expectedSig)
        {
            if (string.IsNullOrEmpty(expectedSig)) return false;
            try
            {
                string envSecret = Environment.GetEnvironmentVariable("LICENSE_TOKEN_SECRET");
                string secret = !string.IsNullOrEmpty(envSecret) ? envSecret : PAYLOAD_INTEGRITY_SECRET;

                string dataToSign = (backendUrl ?? "") + "|" + (licenseKey ?? "") + "|" + (token ?? "") + "|" + (generatedAt ?? "");
                byte[] keyBytes = Encoding.UTF8.GetBytes(secret);
                byte[] dataBytes = Encoding.UTF8.GetBytes(dataToSign);

                using (HMACSHA256 hmac = new HMACSHA256(keyBytes))
                {
                    byte[] hash = hmac.ComputeHash(dataBytes);
                    StringBuilder sb = new StringBuilder();
                    foreach (byte b in hash) sb.Append(b.ToString("x2"));
                    string computedSig = sb.ToString();

                    return string.Equals(computedSig, expectedSig.Trim(), StringComparison.OrdinalIgnoreCase);
                }
            }
            catch
            {
                return false;
            }
        }

        public static bool IsValidBackendUrl(string url)
        {
            if (string.IsNullOrEmpty(url)) return false;
            string u = url.Trim();
            if (u.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) return true;
            if (u.StartsWith("http://localhost:", StringComparison.OrdinalIgnoreCase) || u.Equals("http://localhost", StringComparison.OrdinalIgnoreCase)) return true;
            if (u.StartsWith("http://127.0.0.1:", StringComparison.OrdinalIgnoreCase) || u.Equals("http://127.0.0.1", StringComparison.OrdinalIgnoreCase)) return true;
            return false;
        }

        public static bool TryDetectEmbeddedPayload(string exePath, out string detectedKey, out string detectedToken, out string detectedBackendUrl)
        {
            detectedKey = "";
            detectedToken = "";
            detectedBackendUrl = "";
            try
            {
                if (!File.Exists(exePath)) return false;
                using (FileStream fs = new FileStream(exePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                {
                    if (fs.Length < 100) return false;
                    long readLength = Math.Min(fs.Length, 65536);
                    fs.Seek(fs.Length - readLength, SeekOrigin.Begin);
                    byte[] buf = new byte[readLength];
                    int read = fs.Read(buf, 0, (int)readLength);
                    string tail = Encoding.UTF8.GetString(buf, 0, read);

                    string startTag = "---NAV_BRAHMI_AUTH_START---";
                    string endTag = "---NAV_BRAHMI_AUTH_END---";
                    int sIdx = tail.LastIndexOf(startTag);
                    int eIdx = tail.LastIndexOf(endTag);

                    if (sIdx >= 0 && eIdx > sIdx)
                    {
                        int jsonStart = sIdx + startTag.Length;
                        string jsonStr = tail.Substring(jsonStart, eIdx - jsonStart).Trim();

                        string key = ExtractJsonString(jsonStr, "licenseKey");
                        if (string.IsNullOrEmpty(key)) key = ExtractJsonString(jsonStr, "license_key");

                        string tok = ExtractJsonString(jsonStr, "token");
                        if (string.IsNullOrEmpty(tok)) tok = ExtractJsonString(jsonStr, "authToken");

                        string back = ExtractJsonString(jsonStr, "backendUrl");
                        if (string.IsNullOrEmpty(back)) back = ExtractJsonString(jsonStr, "backend_url");

                        string genAt = ExtractJsonRaw(jsonStr, "generatedAt");
                        if (string.IsNullOrEmpty(genAt)) genAt = ExtractJsonRaw(jsonStr, "generated_at");

                        string sig = ExtractJsonString(jsonStr, "signature");
                        if (string.IsNullOrEmpty(sig)) sig = ExtractJsonString(jsonStr, "sig");

                        // Authenticate / Integrity-protect embedded backendUrl and payload
                        if (!string.IsNullOrEmpty(sig))
                        {
                            bool validSig = VerifyPayloadSignature(back, key, tok, genAt, sig);
                            if (!validSig)
                            {
                                // Tampered payload detected! Discard untrusted embedded data
                                return false;
                            }
                        }

                        // Validate URL structure
                        if (!string.IsNullOrEmpty(back) && IsValidBackendUrl(back))
                        {
                            detectedBackendUrl = back;
                        }

                        detectedKey = key;
                        detectedToken = tok;

                        return !string.IsNullOrEmpty(detectedKey) || !string.IsNullOrEmpty(detectedToken) || !string.IsNullOrEmpty(detectedBackendUrl);
                    }
                }
            }
            catch { }
            return false;
        }


        public string GetWindowsMachineIdentity(string overrideId)
        {
            if (!string.IsNullOrEmpty(overrideId) && overrideId.Trim().Length > 0)
            {
                byte[] simBytes = Encoding.UTF8.GetBytes("DEMO_SIMULATED_WINDOWS_MACHINE:" + overrideId.Trim());
                using (SHA256 sha = SHA256.Create())
                {
                    byte[] hashBytes = sha.ComputeHash(simBytes);
                    StringBuilder sb = new StringBuilder();
                    foreach (byte b in hashBytes) sb.Append(b.ToString("x2"));
                    return sb.ToString();
                }
            }

            List<string> components = new List<string>();

            // 1. Registry MachineGuid
            try
            {
                using (RegistryKey key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Cryptography"))
                {
                    if (key != null)
                    {
                        object val = key.GetValue("MachineGuid");
                        if (val != null && !string.IsNullOrEmpty(val.ToString()))
                        {
                            components.Add("REG_GUID:" + val.ToString().Trim());
                        }
                    }
                }
            }
            catch { }

            // 2. WMI Win32_ComputerSystemProduct UUID
            try
            {
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher("SELECT UUID FROM Win32_ComputerSystemProduct"))
                {
                    foreach (ManagementObject mo in searcher.Get())
                    {
                        object uuidVal = mo["UUID"];
                        if (uuidVal != null && !string.IsNullOrEmpty(uuidVal.ToString()))
                        {
                            components.Add("SYS_UUID:" + uuidVal.ToString().Trim());
                            break;
                        }
                    }
                }
            }
            catch { }

            if (components.Count == 0)
            {
                components.Add("FALLBACK_HOST:" + Environment.MachineName + "-" + Environment.GetEnvironmentVariable("PROCESSOR_ARCHITECTURE"));
            }

            string combined = string.Join("|", components.ToArray());
            byte[] bytes = Encoding.UTF8.GetBytes("WINDOWS_MACHINE:" + combined);
            using (SHA256 sha = SHA256.Create())
            {
                byte[] hashBytes = sha.ComputeHash(bytes);
                StringBuilder sb = new StringBuilder();
                foreach (byte b in hashBytes) sb.Append(b.ToString("x2"));
                return sb.ToString();
            }
        }

        public string ComputeFileSha256(string filePath)
        {
            using (FileStream fs = File.OpenRead(filePath))
            using (SHA256 sha = SHA256.Create())
            {
                byte[] hash = sha.ComputeHash(fs);
                StringBuilder sb = new StringBuilder();
                foreach (byte b in hash) sb.Append(b.ToString("x2"));
                return sb.ToString();
            }
        }

        private string HttpPost(string url, string jsonBody)
        {
            ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072 | (SecurityProtocolType)768 | SecurityProtocolType.Tls;
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url);
            request.Method = "POST";
            request.ContentType = "application/json";
            request.Timeout = 30000;

            byte[] bodyBytes = Encoding.UTF8.GetBytes(jsonBody);
            request.ContentLength = bodyBytes.Length;

            using (Stream reqStream = request.GetRequestStream())
            {
                reqStream.Write(bodyBytes, 0, bodyBytes.Length);
            }

            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            using (StreamReader reader = new StreamReader(response.GetResponseStream(), Encoding.UTF8))
            {
                return reader.ReadToEnd();
            }
        }

        public bool RunInstallation(out string errorMessage, out bool rebootRequired)
        {
            errorMessage = "";
            rebootRequired = false;
            bool isAdmin = IsAdministrator();

            string tempDir = Path.Combine(Path.GetTempPath(), "NavBrahmi_Setup_" + Guid.NewGuid().ToString("N").Substring(0, 8));

            try
            {
                Directory.CreateDirectory(tempDir);

                // If license key is empty but token is present, resolve token first
                if (string.IsNullOrEmpty(_config.LicenseKey) && !string.IsNullOrEmpty(_config.AuthToken))
                {
                    Progress(3, "Resolving purchase authorization token...");
                    string resolveUrl = _config.BackendUrl.TrimEnd('/') + "/api/license/resolve-token";
                    string resolveResp = HttpPost(resolveUrl, "{\"token\":\"" + _config.AuthToken.Trim() + "\"}");
                    int kIdx = resolveResp.IndexOf("\"license_key\":\"");
                    if (kIdx >= 0)
                    {
                        int start = kIdx + 15;
                        int end = resolveResp.IndexOf("\"", start);
                        if (end > start) _config.LicenseKey = resolveResp.Substring(start, end - start);
                    }
                }

                if (string.IsNullOrEmpty(_config.LicenseKey))
                {
                    errorMessage = "No valid license key provided or detected.";
                    Log("[ERROR] " + errorMessage);
                    return false;
                }

                Progress(5, "Deriving hardware machine identity...");
                string machineId = GetWindowsMachineIdentity(_config.MachineOverride);
                Log("Windows Machine Identity: " + machineId);

                Progress(15, "Validating license with backend...");
                string validateUrl = _config.BackendUrl.TrimEnd('/') + "/api/validate-license";
                string valReqJson = "{\"license_key\":\"" + _config.LicenseKey.Trim() + "\",\"platform\":\"WINDOWS\"}";
                string valRespJson;

                try
                {
                    valRespJson = HttpPost(validateUrl, valReqJson);
                }
                catch (WebException wex)
                {
                    string errDetail = wex.Message;
                    if (wex.Response != null)
                    {
                        using (StreamReader sr = new StreamReader(wex.Response.GetResponseStream()))
                        {
                            errDetail = sr.ReadToEnd();
                        }
                    }
                    errorMessage = "License validation failed: " + errDetail;
                    Log("[ERROR] " + errorMessage);
                    return false;
                }

                if (!valRespJson.Contains("\"valid\":true"))
                {
                    errorMessage = "License key is invalid, revoked, or expired.";
                    Log("[ERROR] " + errorMessage);
                    return false;
                }

                // Extract product info and download URL
                string productName = "Nav Brahmi Keyboard Driver";
                int prodIdx = valRespJson.IndexOf("\"product_name\":\"");
                if (prodIdx >= 0)
                {
                    int start = prodIdx + 16;
                    int end = valRespJson.IndexOf("\"", start);
                    if (end > start) productName = valRespJson.Substring(start, end - start);
                }

                string productCode = "NAV-BRAHMI-DRIVER";
                int codeIdx = valRespJson.IndexOf("\"product_code\":\"");
                if (codeIdx >= 0)
                {
                    int start = codeIdx + 16;
                    int end = valRespJson.IndexOf("\"", start);
                    if (end > start) productCode = valRespJson.Substring(start, end - start);
                }

                Log("License verified for product: " + productName);

                Progress(30, "Activating machine license...");
                string actUrl = _config.BackendUrl.TrimEnd('/') + "/api/activation";
                string actReqJson = "{\"license_key\":\"" + _config.LicenseKey.Trim() + "\",\"machine_id\":\"" + machineId + "\",\"product_code\":\"" + productCode + "\",\"platform\":\"WINDOWS\"}";
                string actRespJson;

                try
                {
                    actRespJson = HttpPost(actUrl, actReqJson);
                }
                catch (WebException wex)
                {
                    string errDetail = wex.Message;
                    if (wex.Response != null)
                    {
                        using (StreamReader sr = new StreamReader(wex.Response.GetResponseStream()))
                        {
                            errDetail = sr.ReadToEnd();
                        }
                    }
                    errorMessage = "Machine activation failed: " + errDetail;
                    Log("[ERROR] " + errorMessage);
                    return false;
                }

                if (!actRespJson.Contains("\"activated\":true"))
                {
                    errorMessage = "Machine activation was rejected by server.";
                    Log("[ERROR] " + errorMessage);
                    return false;
                }

                // Extract activation token
                string token = "";
                int tokenIdx = actRespJson.IndexOf("\"token\":\"");
                if (tokenIdx >= 0)
                {
                    int start = tokenIdx + 9;
                    int end = actRespJson.IndexOf("\"", start);
                    if (end > start) token = actRespJson.Substring(start, end - start);
                }

                Log("Machine activation approved! Signed Ed25519 token received.");

                // Save activation token
                try
                {
                    string targetDir = @"C:\Program Files\NavBrahmi";
                    if (!Directory.Exists(targetDir)) Directory.CreateDirectory(targetDir);
                    File.WriteAllText(Path.Combine(targetDir, "activation.token"), token, Encoding.UTF8);
                    Log("Saved activation token to C:\\Program Files\\NavBrahmi\\activation.token");
                }
                catch
                {
                    string userDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "NavBrahmi");
                    if (!Directory.Exists(userDir)) Directory.CreateDirectory(userDir);
                    File.WriteAllText(Path.Combine(userDir, "activation.token"), token, Encoding.UTF8);
                    Log("Saved activation token to " + Path.Combine(userDir, "activation.token"));
                }

                // Extract download URL and SHA256 from validation response
                string downloadUrl = "";
                int urlIdx = valRespJson.IndexOf("\"url\":\"");
                if (urlIdx >= 0)
                {
                    int start = urlIdx + 7;
                    int end = valRespJson.IndexOf("\"", start);
                    if (end > start)
                    {
                        downloadUrl = valRespJson.Substring(start, end - start).Replace("\\u0026", "&");
                    }
                }

                string expectedSha256 = "";
                int shaIdx = valRespJson.IndexOf("\"sha256\":\"");
                if (shaIdx >= 0)
                {
                    int start = shaIdx + 10;
                    int end = valRespJson.IndexOf("\"", start);
                    if (end > start) expectedSha256 = valRespJson.Substring(start, end - start);
                }

                string filename = "driver-package.zip";
                int fnIdx = valRespJson.IndexOf("\"filename\":\"");
                if (fnIdx >= 0)
                {
                    int start = fnIdx + 12;
                    int end = valRespJson.IndexOf("\"", start);
                    if (end > start) filename = valRespJson.Substring(start, end - start);
                }

                if (string.IsNullOrEmpty(downloadUrl))
                {
                    errorMessage = "Download URL not provided by license server.";
                    Log("[ERROR] " + errorMessage);
                    return false;
                }

                Progress(45, "Downloading driver package from secure Backblaze B2...");
                string zipPath = Path.Combine(tempDir, filename);
                Log("Downloading package (" + filename + ")...");

                try
                {
                    using (WebClient wc = new WebClient())
                    {
                        wc.DownloadFile(downloadUrl, zipPath);
                    }
                }
                catch (WebException wex)
                {
                    string errDetail = wex.Message;
                    if (wex.Response != null)
                    {
                        try
                        {
                            using (StreamReader sr = new StreamReader(wex.Response.GetResponseStream()))
                            {
                                string body = sr.ReadToEnd();
                                if (!string.IsNullOrEmpty(body)) errDetail += " (" + body.Trim() + ")";
                            }
                        }
                        catch { }
                    }
                    errorMessage = "Failed to download driver package: " + errDetail;
                    Log("[ERROR] " + errorMessage);
                    return false;
                }

                Progress(65, "Verifying SHA-256 cryptographic checksum...");
                string actualSha256 = ComputeFileSha256(zipPath);
                Log("Local SHA-256:    " + actualSha256);
                Log("Expected SHA-256: " + expectedSha256);

                if (!string.Equals(actualSha256, expectedSha256, StringComparison.OrdinalIgnoreCase))
                {
                    errorMessage = "SHA-256 Checksum Verification Failed! Package integrity compromised.";
                    Log("[ERROR] " + errorMessage);
                    return false;
                }

                Log("Checksum verified successfully (" + actualSha256 + ").");

                Progress(75, "Extracting package contents...");
                string extractDir = Path.Combine(tempDir, "extracted");
                ZipFile.ExtractToDirectory(zipPath, extractDir);

                // Install Fonts
                Progress(80, "Installing Unicode fonts...");
                string[] ttfFiles = Directory.GetFiles(extractDir, "*.ttf", SearchOption.AllDirectories);
                foreach (string fontFile in ttfFiles)
                {
                    string fontName = Path.GetFileName(fontFile);
                    Log("Installing font: " + fontName);
                    try
                    {
                        if (isAdmin)
                        {
                            string targetFontPath = Path.Combine(@"C:\Windows\Fonts", fontName);
                            File.Copy(fontFile, targetFontPath, true);
                            using (RegistryKey fontKey = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts", true))
                            {
                                if (fontKey != null)
                                {
                                    string fontTitle = Path.GetFileNameWithoutExtension(fontName) + " (TrueType)";
                                    fontKey.SetValue(fontTitle, fontName);
                                }
                            }
                            Log("Font registered system-wide: " + fontName);
                        }
                        else
                        {
                            string userFontDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Microsoft\Windows\Fonts");
                            if (!Directory.Exists(userFontDir)) Directory.CreateDirectory(userFontDir);
                            string targetFontPath = Path.Combine(userFontDir, fontName);
                            File.Copy(fontFile, targetFontPath, true);
                            using (RegistryKey fontKey = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows NT\CurrentVersion\Fonts", true))
                            {
                                if (fontKey != null)
                                {
                                    string fontTitle = Path.GetFileNameWithoutExtension(fontName) + " (TrueType)";
                                    fontKey.SetValue(fontTitle, targetFontPath);
                                }
                            }
                            Log("Font registered in user profile: " + fontName);
                        }
                    }
                    catch (Exception fe)
                    {
                        Log("[WARN] Font install notice: " + fe.Message);
                    }
                }

                // Locate and execute architecture MSI
                Progress(85, "Installing keyboard layout driver MSI...");
                string[] msiFiles = Directory.GetFiles(extractDir, "*.msi", SearchOption.AllDirectories);
                if (msiFiles.Length == 0)
                {
                    errorMessage = "No .msi installer found inside driver package.";
                    Log("[ERROR] " + errorMessage);
                    return false;
                }

                string arch = (Environment.GetEnvironmentVariable("PROCESSOR_ARCHITECTURE") ?? "amd64").ToLower();
                string targetMsi = msiFiles[0];

                foreach (string msi in msiFiles)
                {
                    string lowerMsi = msi.ToLower();
                    if ((arch == "amd64" || arch == "x64" || arch == "arm64") && (lowerMsi.Contains("amd64") || lowerMsi.Contains("x64")))
                    {
                        targetMsi = msi;
                        break;
                    }
                    if (arch.Contains("86") && (lowerMsi.Contains("i386") || lowerMsi.Contains("x86")))
                    {
                        targetMsi = msi;
                        break;
                    }
                }

                Log("Selected MSI installer: " + Path.GetFileName(targetMsi));
                string msiLog = Path.Combine(tempDir, "msi_install.log");

                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "msiexec.exe";
                psi.Arguments = "/i \"" + targetMsi + "\" /qn /norestart /l*v \"" + msiLog + "\"";
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;

                Log("Executing msiexec.exe /i \"" + Path.GetFileName(targetMsi) + "\" /qn /norestart...");
                using (Process proc = Process.Start(psi))
                {
                    proc.WaitForExit();
                    int exitCode = proc.ExitCode;
                    Log("MSI Exit Code: " + exitCode);

                    if (exitCode == 0)
                    {
                        Log("Driver package installed and registered successfully.");
                    }
                    else if (exitCode == 3010)
                    {
                        Log("Driver package installed successfully (system restart required).");
                        rebootRequired = true;
                    }
                    else if (exitCode == 1638)
                    {
                        Log("Driver package is already installed and up to date.");
                    }
                    else if (exitCode == 1603 && !isAdmin)
                    {
                        errorMessage = "Administrator elevation required to register layout driver into System32 (Exit Code 1603).";
                        Log("[ERROR] " + errorMessage);
                        return false;
                    }
                    else
                    {
                        errorMessage = "Driver installation returned exit code " + exitCode + ".";
                        if (File.Exists(msiLog))
                        {
                            string logContent = File.ReadAllText(msiLog);
                            Log("[MSI LOG SNIPPET] " + logContent.Substring(Math.Max(0, logContent.Length - 1000)));
                        }
                        return false;
                    }
                }

                Progress(100, "Installation completed successfully!");
                return true;
            }
            catch (Exception ex)
            {
                errorMessage = "Unexpected setup error: " + ex.Message;
                Log("[FATAL] " + errorMessage);
                return false;
            }
            finally
            {
                try
                {
                    if (Directory.Exists(tempDir))
                    {
                        Directory.Delete(tempDir, true);
                    }
                }
                catch { }
            }
        }
    }

    public class SetupForm : Form
    {
        private SetupConfig _config;
        private TextBox _txtLicense;
        private TextBox _txtBackend;
        private ProgressBar _progressBar;
        private Label _lblStatus;
        private Label _lblAutoBadge;
        private ListBox _lstLog;
        private Button _btnInstall;
        private Button _btnClose;
        private Label _lblHeaderTitle;
        private Label _lblHeaderSub;

        public SetupForm(SetupConfig config)
        {
            _config = config;
            InitializeComponents();
        }

        private void InitializeComponents()
        {
            this.Text = "Nav Brahmi Driver Installer";
            this.Size = new Size(580, 540);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.BackColor = Color.FromArgb(248, 249, 250);
            this.Font = new Font("Segoe UI", 9F, FontStyle.Regular);

            // Header Banner
            Panel headerPanel = new Panel();
            headerPanel.Dock = DockStyle.Top;
            headerPanel.Height = 85;
            headerPanel.BackColor = Color.FromArgb(15, 23, 42); // Dark slate

            _lblHeaderTitle = new Label();
            _lblHeaderTitle.Text = "⌨️ Nav Brahmi Driver Suite";
            _lblHeaderTitle.Font = new Font("Segoe UI", 14F, FontStyle.Bold);
            _lblHeaderTitle.ForeColor = Color.White;
            _lblHeaderTitle.Location = new Point(20, 16);
            _lblHeaderTitle.AutoSize = true;
            headerPanel.Controls.Add(_lblHeaderTitle);

            _lblHeaderSub = new Label();
            _lblHeaderSub.Text = "Licensed Windows 11 Keyboard Driver & Typography Bootstrapper";
            _lblHeaderSub.Font = new Font("Segoe UI", 9F, FontStyle.Regular);
            _lblHeaderSub.ForeColor = Color.FromArgb(148, 163, 184);
            _lblHeaderSub.Location = new Point(23, 48);
            _lblHeaderSub.AutoSize = true;
            headerPanel.Controls.Add(_lblHeaderSub);

            this.Controls.Add(headerPanel);

            // Main Body Controls
            int curY = 95;

            // Auto-Detection Banner
            if (_config.AutoDetected)
            {
                _lblAutoBadge = new Label();
                _lblAutoBadge.Text = "✓ License automatically verified from your authorized download";
                _lblAutoBadge.Location = new Point(25, curY);
                _lblAutoBadge.Size = new Size(515, 22);
                _lblAutoBadge.ForeColor = Color.FromArgb(22, 101, 52); // dark green
                _lblAutoBadge.BackColor = Color.FromArgb(220, 252, 231); // light green
                _lblAutoBadge.Font = new Font("Segoe UI", 8.5F, FontStyle.Bold);
                _lblAutoBadge.TextAlign = ContentAlignment.MiddleLeft;
                _lblAutoBadge.Padding = new Padding(6, 0, 0, 0);
                this.Controls.Add(_lblAutoBadge);
                curY += 28;
            }

            Label lblLic = new Label();
            lblLic.Text = "License Key (Auto-detected or manual entry):";
            lblLic.Location = new Point(25, curY);
            lblLic.AutoSize = true;
            lblLic.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
            this.Controls.Add(lblLic);

            curY += 22;
            _txtLicense = new TextBox();
            _txtLicense.Location = new Point(25, curY);
            _txtLicense.Size = new Size(515, 26);
            _txtLicense.Font = new Font("Consolas", 10F, FontStyle.Bold);
            _txtLicense.Text = _config.LicenseKey;
            this.Controls.Add(_txtLicense);

            curY += 34;
            Label lblBack = new Label();
            lblBack.Text = "License Server Endpoint:";
            lblBack.Location = new Point(25, curY);
            lblBack.AutoSize = true;
            this.Controls.Add(lblBack);

            curY += 20;
            _txtBackend = new TextBox();
            _txtBackend.Location = new Point(25, curY);
            _txtBackend.Size = new Size(515, 24);
            _txtBackend.Text = _config.BackendUrl;
            this.Controls.Add(_txtBackend);

            curY += 32;
            _lblStatus = new Label();
            _lblStatus.Text = _config.AutoDetected
                ? "Authorized package ready. Click 'Install Driver' to begin."
                : "Enter or verify your license key, then click 'Install Driver'.";
            _lblStatus.Location = new Point(25, curY);
            _lblStatus.Size = new Size(515, 20);
            _lblStatus.ForeColor = Color.FromArgb(51, 65, 85);
            this.Controls.Add(_lblStatus);

            curY += 22;
            _progressBar = new ProgressBar();
            _progressBar.Location = new Point(25, curY);
            _progressBar.Size = new Size(515, 18);
            _progressBar.Minimum = 0;
            _progressBar.Maximum = 100;
            _progressBar.Value = 0;
            this.Controls.Add(_progressBar);

            curY += 26;
            _lstLog = new ListBox();
            _lstLog.Location = new Point(25, curY);
            _lstLog.Size = new Size(515, 110);
            _lstLog.Font = new Font("Consolas", 8.25F);
            _lstLog.BackColor = Color.FromArgb(241, 245, 249);
            this.Controls.Add(_lstLog);

            curY += 120;
            _btnInstall = new Button();
            _btnInstall.Text = "Install Driver";
            _btnInstall.Location = new Point(310, curY);
            _btnInstall.Size = new Size(130, 34);
            _btnInstall.BackColor = Color.FromArgb(37, 99, 235);
            _btnInstall.ForeColor = Color.White;
            _btnInstall.FlatStyle = FlatStyle.Flat;
            _btnInstall.Font = new Font("Segoe UI", 9.5F, FontStyle.Bold);
            _btnInstall.Click += BtnInstall_Click;
            this.Controls.Add(_btnInstall);

            _btnClose = new Button();
            _btnClose.Text = "Cancel";
            _btnClose.Location = new Point(450, curY);
            _btnClose.Size = new Size(90, 34);
            _btnClose.BackColor = Color.FromArgb(226, 232, 240);
            _btnClose.FlatStyle = FlatStyle.Flat;
            _btnClose.Click += (s, e) => this.Close();
            this.Controls.Add(_btnClose);
        }

        private void AppendLog(string message)
        {
            if (this.InvokeRequired)
            {
                this.Invoke(new Action<string>(AppendLog), message);
                return;
            }
            _lstLog.Items.Add(message);
            _lstLog.TopIndex = _lstLog.Items.Count - 1;
        }

        private void SetProgress(int percent, string status)
        {
            if (this.InvokeRequired)
            {
                this.Invoke(new Action<int, string>(SetProgress), percent, status);
                return;
            }
            _progressBar.Value = Math.Max(0, Math.Min(100, percent));
            _lblStatus.Text = status;
        }

        private void BtnInstall_Click(object sender, EventArgs e)
        {
            string license = _txtLicense.Text.Trim();
            string backend = _txtBackend.Text.Trim();

            if (string.IsNullOrEmpty(license) && string.IsNullOrEmpty(_config.AuthToken))
            {
                MessageBox.Show("Please enter your Nav Brahmi license key or use an authorized installer.", "License Required", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            _config.LicenseKey = license;
            _config.BackendUrl = backend;

            _btnInstall.Enabled = false;
            _txtLicense.Enabled = false;
            _txtBackend.Enabled = false;
            _lstLog.Items.Clear();

            Thread worker = new Thread(() =>
            {
                InstallerEngine engine = new InstallerEngine(_config, AppendLog, SetProgress);
                string error;
                bool rebootRequired;
                bool success = engine.RunInstallation(out error, out rebootRequired);

                this.Invoke(new Action(() =>
                {
                    if (success)
                    {
                        if (rebootRequired)
                        {
                            MessageBox.Show("Nav Brahmi drivers installed successfully!\n\nPlease restart your Windows PC to finalize input method registration.", "Installation Complete", MessageBoxButtons.OK, MessageBoxIcon.Information);
                        }
                        else
                        {
                            MessageBox.Show("Nav Brahmi drivers installed and configured successfully!\n\nYou can now select the Brahmi / Tamil Grantha keyboard layout from the Windows Language Bar.", "Installation Complete", MessageBoxButtons.OK, MessageBoxIcon.Information);
                        }
                        this.Close();
                    }
                    else
                    {
                        _btnInstall.Enabled = true;
                        _txtLicense.Enabled = true;
                        _txtBackend.Enabled = true;
                        MessageBox.Show("Installation encountered an error:\n\n" + error + "\n\nFor help or license recovery, visit:\n" + _config.BackendUrl + "/recover", "Installation Failed", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    }
                }));
            });

            worker.IsBackground = true;
            worker.Start();
        }
    }

    class Program
    {
        [System.Runtime.InteropServices.DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool AttachConsole(int dwProcessId);

        private const int ATTACH_PARENT_PROCESS = -1;

        [STAThread]
        static int Main(string[] args)
        {
            SetupConfig config = new SetupConfig();

            bool hasExplicitBackendArg = false;

            for (int i = 0; i < args.Length; i++)
            {
                string arg = args[i].Trim();
                if (arg.Equals("-LicenseKey", StringComparison.OrdinalIgnoreCase) || arg.Equals("-k", StringComparison.OrdinalIgnoreCase) || arg.Equals("/k", StringComparison.OrdinalIgnoreCase))
                {
                    if (i + 1 < args.Length) config.LicenseKey = args[++i].Trim();
                }
                else if (arg.Equals("-AuthToken", StringComparison.OrdinalIgnoreCase) || arg.Equals("-t", StringComparison.OrdinalIgnoreCase))
                {
                    if (i + 1 < args.Length) config.AuthToken = args[++i].Trim();
                }
                else if (arg.Equals("-BackendUrl", StringComparison.OrdinalIgnoreCase) || arg.Equals("-b", StringComparison.OrdinalIgnoreCase) || arg.Equals("/b", StringComparison.OrdinalIgnoreCase))
                {
                    if (i + 1 < args.Length)
                    {
                        config.BackendUrl = args[++i].Trim();
                        hasExplicitBackendArg = true;
                    }
                }
                else if (arg.Equals("-MachineOverride", StringComparison.OrdinalIgnoreCase) || arg.Equals("-m", StringComparison.OrdinalIgnoreCase))
                {
                    if (i + 1 < args.Length) config.MachineOverride = args[++i].Trim();
                }
                else if (arg.Equals("-Silent", StringComparison.OrdinalIgnoreCase) || arg.Equals("/silent", StringComparison.OrdinalIgnoreCase) || arg.Equals("/s", StringComparison.OrdinalIgnoreCase) || arg.Equals("-q", StringComparison.OrdinalIgnoreCase))
                {
                    config.Silent = true;
                }
                else if (arg.Equals("-Help", StringComparison.OrdinalIgnoreCase) || arg.Equals("/?", StringComparison.OrdinalIgnoreCase))
                {
                    MessageBox.Show("Nav Brahmi Driver Setup.exe\n\nUsage:\n  Setup.exe [-LicenseKey <KEY>] [-BackendUrl <URL>] [-Silent]", "Setup.exe Help", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return 0;
                }
            }

            if (config.Silent)
            {
                AttachConsole(ATTACH_PARENT_PROCESS);
            }

            // Check if environment variables are set
            string envBackend = Environment.GetEnvironmentVariable("BACKEND_URL");
            if (!string.IsNullOrEmpty(envBackend) && !hasExplicitBackendArg)
            {
                config.BackendUrl = envBackend.Trim();
            }

            if (string.IsNullOrEmpty(config.LicenseKey))
            {
                string envKey = Environment.GetEnvironmentVariable("LICENSE_KEY");
                if (!string.IsNullOrEmpty(envKey)) config.LicenseKey = envKey.Trim();
            }

            // AUTO-DETECTION: Check if signed payload is embedded in this executable
            string detectedKey, detectedToken, detectedBackendUrl;
            string exeLoc = System.Reflection.Assembly.GetExecutingAssembly().Location;
            if (string.IsNullOrEmpty(exeLoc) || !File.Exists(exeLoc)) exeLoc = Application.ExecutablePath;

            if (InstallerEngine.TryDetectEmbeddedPayload(exeLoc, out detectedKey, out detectedToken, out detectedBackendUrl))
            {
                if (!string.IsNullOrEmpty(detectedKey) && string.IsNullOrEmpty(config.LicenseKey))
                {
                    config.LicenseKey = detectedKey;
                    config.AutoDetected = true;
                }
                if (!string.IsNullOrEmpty(detectedToken) && string.IsNullOrEmpty(config.AuthToken))
                {
                    config.AuthToken = detectedToken;
                    config.AutoDetected = true;
                }
                if (!string.IsNullOrEmpty(detectedBackendUrl) && !hasExplicitBackendArg && string.IsNullOrEmpty(envBackend))
                {
                    config.BackendUrl = detectedBackendUrl;
                }
            }

            // AUTO-DETECTION FALLBACK: Check companion setup.ini or setup.auth in same folder
            try
            {
                string dir = Path.GetDirectoryName(Application.ExecutablePath);
                string iniPath = Path.Combine(dir, "setup.ini");
                if (File.Exists(iniPath))
                {
                    foreach (string line in File.ReadAllLines(iniPath))
                    {
                        string t = line.Trim();
                        if (t.StartsWith("LicenseKey=", StringComparison.OrdinalIgnoreCase) && string.IsNullOrEmpty(config.LicenseKey))
                        {
                            config.LicenseKey = t.Substring(11).Trim();
                            config.AutoDetected = true;
                        }
                        if (t.StartsWith("BackendUrl=", StringComparison.OrdinalIgnoreCase) && !hasExplicitBackendArg && string.IsNullOrEmpty(envBackend))
                        {
                            config.BackendUrl = t.Substring(11).Trim();
                        }
                    }
                }
            }
            catch { }

            // AUTO-DETECTION FALLBACK: Check clipboard if it has NAV- or DEMO- license key (interactive only)
            if (!config.Silent && string.IsNullOrEmpty(config.LicenseKey))
            {
                try
                {
                    if (Clipboard.ContainsText())
                    {
                        string clip = Clipboard.GetText();
                        if (!string.IsNullOrEmpty(clip) && (clip.StartsWith("DEMO-") || clip.StartsWith("NAV-")))
                        {
                            config.LicenseKey = clip.Trim();
                        }
                    }
                }
                catch { }
            }

            // Check UAC elevation if interactive GUI mode
            if (!config.Silent && !InstallerEngine.IsAdministrator())
            {
                try
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = Application.ExecutablePath;
                    List<string> quotedArgs = new List<string>();
                    foreach (string a in args) quotedArgs.Add("\"" + a + "\"");
                    psi.Arguments = string.Join(" ", quotedArgs.ToArray());
                    psi.Verb = "runas";
                    psi.UseShellExecute = true;

                    Process elevatedProc = Process.Start(psi);
                    return 0;
                }
                catch
                {
                    // User declined UAC prompt
                }
            }

            if (config.Silent)
            {
                string err;
                bool reboot;
                InstallerEngine engine = new InstallerEngine(config, (m) => Console.WriteLine(m), (p, s) => { });
                bool ok = engine.RunInstallation(out err, out reboot);
                if (!ok) Console.Error.WriteLine("[FATAL ERROR] " + err);
                return ok ? 0 : 1;
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SetupForm(config));
            return 0;
        }
    }
}
