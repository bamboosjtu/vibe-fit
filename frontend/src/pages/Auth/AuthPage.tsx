import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  IconButton,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";
import { useAuthStore } from "../../stores/authStore";
import { post } from "../../services/apiClient";

const authMode = import.meta.env.VITE_AUTH_MODE ?? "mock";
const isGoogleMode = authMode === "google";

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 根据状态调用对应的 API，在开发环境下后端对这两个接口都提供了模拟支持
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const response = await post<{
        token: string;
        user: { id: string; email: string };
      }>(endpoint, {
        email,
        password,
      });

      if (response.token) {
        setAuth(response.token, response.user);
        // 登录成功后跳转回设置页面
        navigate("/settings");
      } else {
        throw new Error("未收到有效的 Token");
      }
    } catch (err) {
      console.error("Auth error:", err);
      setError(
        err instanceof Error ? err.message : "身份验证失败，请检查账号密码",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: {
    credential?: string;
  }) => {
    setError("");
    setLoading(true);

    try {
      if (!credentialResponse.credential) {
        throw new Error("未收到 Google 登录凭证");
      }

      const response = await post<{
        token: string;
        user: {
          id: string;
          email: string;
          name?: string | null;
          avatarUrl?: string | null;
        };
      }>("/api/auth/google", {
        idToken: credentialResponse.credential,
      });

      if (response.token) {
        setAuth(response.token, response.user);
        navigate("/settings");
      } else {
        throw new Error("未收到有效的 Token");
      }
    } catch (err) {
      console.error("Google auth error:", err);
      setError(err instanceof Error ? err.message : "Google 登录失败");
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
            {isLogin ? "登录 VibeFit" : "注册账号"}
          </Typography>

          <Typography
            variant="body2"
            align="center"
            color="text.secondary"
            mb={4}
            sx={{ fontFamily: '"Nunito", sans-serif' }}
          >
            {isLogin ? "同步您的训练数据到云端" : "创建一个新账号开启云端备份"}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: "12px" }}>
              {error}
            </Alert>
          )}
          {!isGoogleMode && (
            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="电子邮箱"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                margin="normal"
                required
                variant="outlined"
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
              />
              <TextField
                fullWidth
                label="密码"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
                required
                inputProps={{ minLength: 6 }}
                variant="outlined"
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
                {loading ? "处理中..." : isLogin ? "立即登录" : "确认注册"}
              </Button>
            </form>
          )}

          <Box sx={{ mt: 3, display: "flex", justifyContent: "center" }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError("Google 登录失败")}
            />
          </Box>

          <Button
            fullWidth
            variant="text"
            onClick={() => setIsLogin(!isLogin)}
            sx={{
              textTransform: "none",
              color: "text.secondary",
              fontFamily: '"Nunito", sans-serif',
            }}
          >
            {isLogin ? "还没有账号？点此注册" : "已有账号？点此登录"}
          </Button>
        </Paper>
      </Box>
    </Box>
  );
}
