import React from 'react'
import TwoFASetup from '../components/TwoFASetup'
import {useNavigate, useSearchParams} from 'react-router-dom'
import { skip2faOnboarding } from '../service/authApi';
import { useSessionContext } from '../context/SessionContext';

const Setup2fa = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useSessionContext();
  const isFromProfile = searchParams.get('from') === 'profile';
  const isFirstLoginOnboarding = user?.hasCompleted2faOnboarding === false;
  const canSkip = !isFromProfile && isFirstLoginOnboarding;

  const handleSetupComplete = () => {
    navigate('/verify-2fa');
  }

  const handleSkip = async () => {
    try {
      await skip2faOnboarding();
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
    } finally {
      navigate('/home');
    }
  }

  return (
    <TwoFASetup onSetupComplete={handleSetupComplete} onSkip={canSkip ? handleSkip : null} />
  )
}

export default Setup2fa