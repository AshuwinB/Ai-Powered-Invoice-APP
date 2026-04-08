import { useEffect, useState } from 'react';
import { register, loginUser, completeChallengeLogin } from '../service/authApi';



const LoginForm = ({onLoginSuccess}) => {
    const [isRegistered, setIsRegistered] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [pendingChallenge, setPendingChallenge] = useState(null);

    useEffect(() => {
        if (!pendingChallenge?.challengeId || !pendingChallenge?.challengeToken) {
            return;
        }

        const es = new EventSource(
            `http://localhost:7001/api/auth/login/challenge-stream/${pendingChallenge.challengeId}`
        );

        const handleApproved = async () => {
            try {
                const loginData = await completeChallengeLogin(
                    pendingChallenge.challengeId,
                    pendingChallenge.challengeToken
                );
                setPendingChallenge(null);
                setMessage(loginData.message || 'Login approved.');
                onLoginSuccess(loginData);
            } catch (err) {
                console.error('Failed to complete challenge login:', err);
                setPendingChallenge(null);
                setError('Login approval failed. Please sign in again.');
            }
        };

        es.addEventListener('approved', handleApproved);

        es.addEventListener('rejected', (event) => {
            let payload = {};
            try {
                payload = JSON.parse(event.data || '{}');
            } catch (error) {
                payload = {};
            }

            setPendingChallenge(null);
            if (payload.reason === 'incorrect_code') {
                setError('The wrong security code was selected on your trusted device. This login attempt was cancelled. Please sign in again.');
                return;
            }

            setError('Login request was rejected from your trusted device.');
        });

        es.addEventListener('expired', () => {
            setPendingChallenge(null);
            setError('Login request expired. Please sign in again.');
        });

        es.onerror = () => {
            es.close();
        };

        return () => {
            es.close();
        };
    }, [pendingChallenge, onLoginSuccess]);

    const handleRegister = async (e) => {
        e.preventDefault();
        try {
            if (password !== confirmPassword) {
                setError("Passwords do not match");
                return;
            }
            const data = await register(username, password);
            setMessage(data.message);
            setIsRegistered(true);
            setUsername('');
            setPassword('');
            setConfirmPassword('');
            setError('');
            // const {data} = await register(username, password);
            // setMessage(data.message);
            // setIsRegistered(false);
            // setUsername('');
            // setPassword('');
            // setConfirmPassword('');
        } catch (error) {
            console.error(error.message);
            setError("Something went wrong during registration");
            setUsername('');
            setPassword('');
            setConfirmPassword('');
            setMessage('');
        }
    }
    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            console.log('Attempting login with username:', username);
            const data = await loginUser(username, password);
            console.log('Login response:', data);

            if (data.requiresDeviceApproval) {
                setPendingChallenge({
                    challengeId: data.challengeId,
                    challengeToken: data.challengeToken,
                    securityCode: data.securityCode,
                    expiresAt: data.expiresAt,
                });
                setMessage('Approve this login from your trusted device.');
                setError('');
                return;
            }

            setMessage(data.message);
            setUsername('');
            setPassword('');
            setError('');
            console.log('Calling onLoginSuccess with:', data);
            onLoginSuccess(data);
        } catch (error) {
            console.error('Login error:', error);
            setError(error.message || "Invalid username or password");
            setMessage('');
            setUsername('');
            setPassword('');
        }
    }
    const handleRegisterToggle = () => {
        setIsRegistered(!isRegistered);
        setError('');
        setMessage('');
    }
  return (
    <>
    <form action="" onSubmit={isRegistered ? handleLogin : handleRegister} className='w-full max-w-xl mx-auto page-enter border-b border-slate-200 pb-8'>
        <div className='pb-6'>
            <p className='text-xs uppercase tracking-[0.2em] text-slate-500'>Welcome</p>
            <h2 className='text-3xl font-semibold mt-2 text-slate-900'>{isRegistered ? "Sign In" : "Create Account"}</h2>
            <p className='text-slate-600 text-sm sm:text-base mt-3'>{isRegistered ? "Welcome back. Let us get you into your workspace." : "Create your account to begin managing invoices."}</p>
        </div>
    <div className='space-y-4'>
        <div className='mb-4'>
            <label className='text-slate-600 text-sm font-medium'>Username</label>
            <input value={username} onChange = {(e) => setUsername(e.target.value)} label="username" type='text' className='w-full border border-slate-300 bg-white px-4 py-3 rounded-lg mt-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors' required/>
        </div>
        <div className='mb-4'>
            <label className='text-slate-600 text-sm font-medium'>Password</label>
            <input value={password} onChange = {(e) => setPassword(e.target.value)} label="password" type='password' className='w-full border border-slate-300 bg-white px-4 py-3 rounded-lg mt-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors' required/>
        </div>
        {isRegistered ? null : (<div className='mb-4'>
            <label className='text-slate-600 text-sm font-medium'>Confirm Password</label>
            <input value={confirmPassword} onChange = {(e) => setConfirmPassword(e.target.value)} label="confirmPassword" type='password' className='w-full border border-slate-300 bg-white px-4 py-3 rounded-lg mt-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors' required/>
        </div>)}   
        {error && <p className='text-rose-600 text-sm mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2'>{error}</p>}
        {message && <p className='text-emerald-700 text-sm mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2'>{message}</p>}
                {pendingChallenge && (
                    <div className='mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900'>
                        <p className='font-semibold'>Security approval required</p>
                        <p className='mt-1'>Open your trusted device and approve this login request by selecting code <strong>{pendingChallenge.securityCode}</strong>.</p>
                    </div>
                )}
        <button
  type='submit'
    disabled={error?.toLowerCase().includes('locked') || Boolean(pendingChallenge)}
  className={`w-full py-2.5 rounded-xl font-semibold transition-colors ${
        error?.toLowerCase().includes('locked') || pendingChallenge
      ? 'bg-slate-400 cursor-not-allowed text-white'
                        : 'bg-teal-600 hover:bg-teal-700 text-white'
  }`}
>
    {pendingChallenge ? "Waiting for approval..." : isRegistered ? "Sign In" : "Create Account"}
</button>
        <div className='mt-4'>
            <p className='text-sm text-slate-600 text-center'>{isRegistered ? "Need an account? " : "Already registered? "}
              <button type='button' className='text-teal-700 font-semibold hover:text-teal-800 hover:underline' onClick={() => handleRegisterToggle()}>{isRegistered ? "Create account" : "Sign in"}</button>
            </p>
        </div>
    </div>
    </form>
    </>
  )
}
export default LoginForm