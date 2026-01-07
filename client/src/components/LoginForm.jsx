import  {useState} from 'react';
import { Link } from 'react-router-dom'
import { register, loginUser } from '../service/authApi';



const LoginForm = ({onLoginSuccess}) => {
    const [isRegistered, setIsRegistered] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

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
            const data = await loginUser(username, password);
            setMessage(data.message);
            setUsername('');
            setPassword('');
            setError('');
            onLoginSuccess(data);
        } catch (error) {
            console.error(error.message);
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
    <form action="" onSubmit={isRegistered ? handleLogin : handleRegister} className='bg-white rounded-lg shadow-md w-full max-w-sm mx-auto'>
        <div className='pt-6'>
            <h2 className='text-3xl text-center font-extralight'>{isRegistered ? "Login" : "Create an Account"}</h2>
        </div>
    <hr className='text-gray-200 mt-6 mb-6'/>
    <p className='text-center text-gray-600 text-lg font-light'>{isRegistered ? "We are glad to see you again." : "Join us today!"}</p>
    <div className='p-6'>
        <div className='mb-4'>
            <label className='text-gray-600 text-sm'>Username</label>
            <input value={username} onChange = {(e) => setUsername(e.target.value)} label="username" type='text' className='w-full border border-gray-300 px-3 py-2 rounded-lg mt-1 focus:outline-none focus:border-blue-500' required/>
        </div>
        <div className='mb-4'>
            <label className='text-gray-600 text-sm'>Password</label>
            <input value={password} onChange = {(e) => setPassword(e.target.value)} label="password" type='password' className='w-full border border-gray-300 px-3 py-2 rounded-lg mt-1 focus:outline-none focus:border-blue-500' required/>
        </div>
        {isRegistered ? null : (<div className='mb-4'>
            <label className='text-gray-600 text-sm'>Confirm Password</label>
            <input value={confirmPassword} onChange = {(e) => setConfirmPassword(e.target.value)} label="confirmPassword" type='password' className='w-full border border-gray-300 px-3 py-2 rounded-lg mt-1 focus:outline-none focus:border-blue-500' required/>
        </div>)}   
        {error && <p className='text-red-500 text-sm mb-4'>{error}</p>}
        {message && <p className='text-green-500 text-sm mb-4'>{message}</p>}
        <button
  type='submit'
  disabled={error?.toLowerCase().includes('locked')}
  className={`w-full py-2 rounded-lg transition-colors ${
    error?.toLowerCase().includes('locked')
      ? 'bg-gray-400 cursor-not-allowed'
      : 'bg-blue-500 hover:bg-blue-600 text-white'
  }`}
>
  {isRegistered ? "Login" : "Create Account"}
</button>
        {/* <button type='submit' className='w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors'>{isRegistered ? "Login" : "Create Account"}</button> */}
        <div>
            <p>{isRegistered ? "Don't have an account? " : "Already have an account? "}<Link to="" className='text-blue-500 hover:underline' onClick={() => handleRegisterToggle()}>{isRegistered ? "Create account" : "Login"}</Link></p>
        </div>
    </div>
    </form>
    </>
  )
}
export default LoginForm