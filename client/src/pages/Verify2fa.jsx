import React from 'react'
import {useNavigate} from 'react-router-dom'
import TowFAVerify from '../components/TwoFAVerify'

const Verify2fa = () => {
  const navigate = useNavigate();

  const handleVerification = async(data) => {
    if(data){
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