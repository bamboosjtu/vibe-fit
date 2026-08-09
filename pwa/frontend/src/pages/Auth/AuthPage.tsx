import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  IconButton,
  InputAdornment,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  ArrowBack as ArrowBackIcon,
  Dns as DnsIcon,
  Email as EmailIcon,
  Lock as LockIcon,
} from "@mui/icons-material";
import { useAuthStore } from "../../stores/authStore";
import { post } from "../../services/apiClient";
import { isNativePlatform } from '../../db/repository';
import {
  getConfiguredServerOrigin,
  saveServerOrigin,
  testServerConnection,
} from '../../services/serverConfig';

type Step = "server" | "email" | "code";

export function AuthPage() {
  const nativePlatform = isNativePlatform();
  const configuredServer = getConfiguredServerOrigin();
  const [step, setStep] = useState<Step>(
    nativePlatform && !configuredServer ? "server" : "email",
  );
  const [serverInput, setServerInput] = useState(configuredServer ?? "");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = window.setTimeout(() => {
      setResendCooldown((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const startCooldown = () => setResendCooldown(60);

  const handleConfigureServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      const result = await testServerConnection(serverInput);
      await saveServerOrigin(result.origin);
      setServerInput(result.origin);
      setInfo(
        `服务器连接成功${result.version ? `（版本 ${result.version}）` : ""}，延迟 ${result.latencyMs}ms`,
      );
      setStep("email");
    } catch (err) {
      setError(err instanceof Error ? err.message : "服务器连接失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      const response = await post<{ success: boolean; devCode?: string; message?: string }>(
        "/api/auth/send-code",
        { email },
      );

      if (response.success) {
        setStep("code");
        startCooldown();

        // 后端测试模式会返回 devCode，便于联调/测试时直接填写
        if (response.devCode) {
          setCode(response.devCode);
          setInfo(`测试模式：验证码为 ${response.devCode}（已自动填入）`);
        } else {
          setInfo("验证码已发送，请查收邮件");
        }
      } else {
        throw new Error(response.message || "验证码发送失败");
      }
    } catch (err) {
      console.error("Send code error:", err);
      setError(
        err instanceof Error ? err.message : "验证码发送失败，请稍后重试",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      const response = await post<{
        token: string;
        user: { id: string; email: string };
      }>("/api/auth/verify-code", {
        email,
        code,
      });

      if (response.token) {
        setAuth(response.token, response.user);
        navigate("/settings");
      } else {
        throw new Error("未收到有效的 Token");
      }
    } catch (err) {
      console.error("Verify code error:", err);
      setError(err instanceof Error ? err.message : "验证码校验失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        bgcolor: "background.default",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ p: 2 }}>
        <IconButton onClick={() => navigate("/settings")}>
          <ArrowBackIcon />
        </IconButton>
      </Box>

      <Box
        sx={{
          display: "flex",
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          p: 2,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 4,
            width: "100%",
            maxWidth: 400,
            borderRadius: 6,
            border: "1px solid",
            borderColor: "divider",
            boxShadow: "0 8px 32px rgba(16, 185, 129, 0.08)",
          }}
        >
          <Typography
            variant="h5"
            align="center"
            fontWeight="bold"
            mb={1}
            sx={{
              fontFamily: '"Poppins", sans-serif',
              background: "linear-gradient(135deg, #10B981 0%, #06B6D4 100%)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {step === "server" ? "连接家庭服务器" : "登录 VibeFit"}
          </Typography>

          <Typography
            variant="body2"
            align="center"
            color="text.secondary"
            mb={4}
            sx={{ fontFamily: '"Nunito", sans-serif' }}
          >
            {step === "server"
              ? "先配置由私有 CA 保护的 HTTPS 服务地址"
              : step === "email"
              ? "使用邮箱验证码登录，同步训练数据到云端"
              : `已向 ${email} 发送验证码`}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: "12px" }}>
              {error}
            </Alert>
          )}
          {info && (
            <Alert severity="success" sx={{ mb: 3, borderRadius: "12px" }}>
              {info}
            </Alert>
          )}

          {step === "server" ? (
            <form onSubmit={handleConfigureServer}>
              <TextField
                fullWidth
                label="服务器 HTTPS 地址"
                placeholder="https://vibefit.home.example"
                type="url"
                value={serverInput}
                onChange={(e) => setServerInput(e.target.value)}
                margin="normal"
                required
                variant="outlined"
                autoCapitalize="none"
                autoCorrect="off"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <DnsIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
                helperText="只接受 HTTPS 域名或 IP，不要填写 /api 路径"
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
                sx={{
                  mt: 4,
                  mb: 2,
                  py: 1.5,
                  borderRadius: "12px",
                  background:
                    "linear-gradient(135deg, #10B981 0%, #06B6D4 100%)",
                  fontWeight: "bold",
                  textTransform: "none",
                  fontSize: "1rem",
                }}
              >
                {loading ? "正在测试连接..." : "测试并保存"}
              </Button>
            </form>
          ) : step === "email" ? (
            <form onSubmit={handleSendCode}>
              <TextField
                fullWidth
                label="电子邮箱"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                margin="normal"
                required
                variant="outlined"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
                sx={{
                  mt: 4,
                  mb: 2,
                  py: 1.5,
                  borderRadius: "12px",
                  background:
                    "linear-gradient(135deg, #10B981 0%, #06B6D4 100%)",
                  fontWeight: "bold",
                  textTransform: "none",
                  fontSize: "1rem",
                  fontFamily: '"Poppins", sans-serif',
                  boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)",
                  "&:hover": {
                    background:
                      "linear-gradient(135deg, #059669 0%, #0891B2 100%)",
                  },
                }}
              >
                {loading ? "发送中..." : "获取验证码"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode}>
              <TextField
                fullWidth
                label="验证码"
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                margin="normal"
                required
                variant="outlined"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
                sx={{
                  mt: 4,
                  mb: 2,
                  py: 1.5,
                  borderRadius: "12px",
                  background:
                    "linear-gradient(135deg, #10B981 0%, #06B6D4 100%)",
                  fontWeight: "bold",
                  textTransform: "none",
                  fontSize: "1rem",
                  fontFamily: '"Poppins", sans-serif',
                  boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)",
                  "&:hover": {
                    background:
                      "linear-gradient(135deg, #059669 0%, #0891B2 100%)",
                  },
                }}
              >
                {loading ? "校验中..." : "登录 / 注册"}
              </Button>
              <Box
                sx={{
                  mt: 1,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Button
                  variant="text"
                  size="small"
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setError("");
                    setInfo("");
                  }}
                  sx={{
                    textTransform: "none",
                    color: "text.secondary",
                    fontFamily: '"Nunito", sans-serif',
                  }}
                >
                  换个邮箱
                </Button>
                <Button
                  variant="text"
                  size="small"
                  disabled={resendCooldown > 0 || loading}
                  onClick={handleSendCode}
                  sx={{
                    textTransform: "none",
                    color: "text.secondary",
                    fontFamily: '"Nunito", sans-serif',
                  }}
                >
                  {resendCooldown > 0 ? `${resendCooldown}s 后重发` : "重新发送"}
                </Button>
              </Box>
            </form>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
