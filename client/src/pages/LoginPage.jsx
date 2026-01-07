import React from 'react'
import LoginForm from '../components/LoginForm'
import { useNavigate } from 'react-router-dom';
import { useSessionContext } from '../context/SessionContext';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useSessionContext();

  const handleLoginSuccess = (userData) => {
    console.log("Login successful:", userData);
    login(userData);
    if (userData.isMfaActivate) {
        navigate('/verify-2fa');
    } else {      
      navigate('/setup-2fa');
    }
  }
  return (
    <LoginForm onLoginSuccess={handleLoginSuccess} />
  )
}

export default LoginPage