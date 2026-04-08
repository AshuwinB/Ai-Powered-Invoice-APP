import React from 'react'
import {useNavigate} from 'react-router-dom'
import { useSessionContext } from '../context/SessionContext';
import TowFAVerify from '../components/TwoFAVerify'
import { authStatus } from '../service/authApi';

const Verify2fa = () => {
  const navigate = useNavigate();
  const { setIsMfaVerified, user, trustDevice, login } = useSessionContext();

  const handleVerification = async(data) => {
    if(data){
      let verifiedUsername = user?.user || user?.username;
      try {
        const authData = await authStatus();
        login(authData);
        verifiedUsername = authData?.user || authData?.username || verifiedUsername;
      } catch (error) {
        console.error('Failed to refresh auth status after 2FA verify:', error);
      }
      // Mark this device as trusted for future logins
      if (verifiedUsername) {
        trustDevice(verifiedUsername);
      }
      setIsMfaVerified(true);
      navigate('/home');
    }
  }
  const handle2faReset = async(data) => {
      if(data){
        navigate('/setup-2fa');
      }
    }
  return (
    <TowFAVerify onVerifySuccess={handleVerification} onResetSuccess={handle2faReset} />
  )
}

export default Verify2fa