/**
 * SECURITY VERIFICATION MODAL USAGE EXAMPLES
 * 
 * This file demonstrates how to use the SecurityVerificationModal component
 * for protecting sensitive actions in your application.
 */

import React, { useState } from 'react';
import SecurityVerificationModal from './SecurityVerificationModal';

/**
 * Example 1: Simple usage in a component
 */
export const SensitiveActionExample = () => {
    const [verificationOpen, setVerificationOpen] = useState(false);
    const [message, setMessage] = useState('');

    const handleDeleteAccount = () => {
        setVerificationOpen(true);
    };

    const handleVerified = () => {
        setMessage('Account deleted successfully!');
        setVerificationOpen(false);
        // Perform the sensitive action here
    };

    return (
        <div>
            <button onClick={handleDeleteAccount} className="bg-red-600 text-white px-4 py-2 rounded">
                Delete Account
            </button>
            {message && <p className="text-green-600 mt-2">{message}</p>}
            <SecurityVerificationModal
                isOpen={verificationOpen}
                title="Verify Your Identity"
                message="This is a sensitive action. Please enter your 2FA code to confirm."
                onVerified={handleVerified}
                onCancel={() => setVerificationOpen(false)}
            />
        </div>
    );
};

/**
 * Example 2: Hook for managing security verification
 */
export const useSecurityVerification = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [config, setConfig] = useState({
        title: '',
        message: '',
        action: null,
    });

    const requestVerification = (title, message, action) => {
        setConfig({ title, message, action });
        setIsOpen(true);
    };

    const handleVerified = () => {
        if (config.action) {
            config.action();
        }
        setIsOpen(false);
    };

    return {
        isOpen,
        config,
        requestVerification,
        handleVerified,
        onCancel: () => setIsOpen(false),
    };
};

/**
 * Example 3: Using the hook in a component
 */
export const InvoiceDeletionExample = () => {
    const verification = useSecurityVerification();

    const handleDeleteInvoice = (invoiceId) => {
        verification.requestVerification(
            'Delete Invoice',
            'Deleting an invoice is permanent. Please verify with your 2FA code.',
            () => {
                console.log('Deleting invoice:', invoiceId);
                // Perform deletion
            }
        );
    };

    return (
        <div>
            <button 
                onClick={() => handleDeleteInvoice('123')}
                className="bg-red-600 text-white px-4 py-2 rounded"
            >
                Delete Invoice
            </button>
            <SecurityVerificationModal
                isOpen={verification.isOpen}
                title={verification.config.title}
                message={verification.config.message}
                onVerified={verification.handleVerified}
                onCancel={verification.onCancel}
            />
        </div>
    );
};

/**
 * INTEGRATION GUIDE:
 * 
 * 1. IMPORT the component:
 *    import SecurityVerificationModal from '../components/SecurityVerificationModal';
 * 
 * 2. ADD to your component:
 *    const [verificationOpen, setVerificationOpen] = useState(false);
 * 
 * 3. CREATE a handler:
 *    const handleSensitiveAction = () => {
 *        setVerificationOpen(true);
 *    };
 * 
 * 4. ADD the modal JSX:
 *    <SecurityVerificationModal
 *        isOpen={verificationOpen}
 *        title="Verify Action"
 *        message="Enter your 2FA code to proceed"
 *        onVerified={() => {
 *            // Perform your sensitive action here
 *            setVerificationOpen(false);
 *        }}
 *        onCancel={() => setVerificationOpen(false)}
 *    />
 * 
 * 5. TRIGGER the handler on button click:
 *    <button onClick={handleSensitiveAction}>
 *        Perform Sensitive Action
 *    </button>
 * 
 * BEST PRACTICES:
 * - Always show clear messages about what action requires verification
 * - Use for: account changes, invoice deletion, export operations, etc.
 * - Don't use for every action (only truly sensitive ones)
 * - Combine with requireMfaVerification() from SessionContext if needed
 */
