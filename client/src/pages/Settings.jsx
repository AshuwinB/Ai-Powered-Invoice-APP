import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionContext } from '../context/SessionContext';
import { settingsApi } from '../service/invoiceApi';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import { AlertCircle, Shield, LogOut, Save, Briefcase, DollarSign, Percent, Clock, FileText, Palette, File, Eye } from 'lucide-react';

const Settings = () => {
    const navigate = useNavigate();
    const { user, logout, logoutAllDevices, getTrustedDevices } = useSessionContext();
    const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('business');
    const [showPreview, setShowPreview] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [settings, setSettings] = useState({
        businessInfo: {
            businessName: '',
            email: '',
            phone: '',
            address: '',
            website: '',
            logo: null
        },
        currency: {
            currency: 'USD',
            symbol: '$'
        },
        tax: {
            defaultTaxRate: 0,
            taxName: 'Tax'
        },
        payment: {
            defaultPaymentDeadlineDays: 30,
            defaultPaymentTerms: 'Due upon receipt'
        },
        invoice: {
            numberFormat: 'INV-{YYYY}{MM}{DD}-{###}',
            notesAndTerms: 'Thank you for your business!'
        },
        theme: {
            template: 'modern',
            primaryColor: '#3B82F6',
            accentColor: '#1E40AF'
        },
        pdf: {
            paperSize: 'A4',
            orientation: 'portrait',
            marginTop: 50,
            marginBottom: 50,
            marginLeft: 50,
            marginRight: 50,
            fontFamily: 'Helvetica',
            fontSize: 12,
            showLogo: true,
            showWatermark: false,
            watermarkText: 'DRAFT'
        },
        signature: {
            name: '',
            image: null
        }
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await settingsApi.getSettings();
            if (response.data) {
                setSettings(prevSettings => ({
                    ...prevSettings,
                    ...response.data
                }));
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    };

    const handleInputChange = (section, field, value) => {
        setSettings(prevSettings => ({
            ...prevSettings,
            [section]: {
                ...prevSettings[section],
                [field]: value
            }
        }));
    };

    const handleImageUpload = (section, field, file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            handleInputChange(section, field, reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await settingsApi.updateSettings(settings);
            setMessage('Settings saved successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error('Error saving settings:', error);
            setMessage('Failed to save settings. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogoutAllDevices = async () => {
        logoutAllDevices(user.user || user.username);
        setMessage('Successfully logged out from all devices. Please login again to verify.');
        setConfirmLogoutAll(false);
        setTimeout(() => {
            logout();
            navigate('/login');
        }, 2000);
    };

    const generatePreview = async () => {
        setPreviewLoading(true);
        try {
            // Create a sample invoice with current settings
            const sampleInvoice = {
                invoice_no: 'PREVIEW-001',
                invoice_date: new Date().toISOString().split('T')[0],
                due_date: new Date(Date.now() + settings.payment.defaultPaymentDeadlineDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                from: {
                    name: settings.businessInfo.businessName || 'Your Business Name',
                    email: settings.businessInfo.email || 'contact@business.com',
                    address1: settings.businessInfo.address || '123 Business St, City, Country'
                },
                to: {
                    name: 'Sample Client',
                    email: 'client@example.com',
                    address1: '456 Client Ave, City, Country'
                },
                items: [
                    {
                        item_name: 'Sample Service',
                        quantity: 1,
                        price: 100.00,
                        total: 100.00
                    },
                    {
                        item_name: 'Additional Work',
                        quantity: 2,
                        price: 50.00,
                        total: 100.00
                    }
                ],
                sub_total: 200.00,
                discount: 0,
                tax_percentage: settings.tax.defaultTaxRate,
                total: 200.00 + (200.00 * settings.tax.defaultTaxRate / 100),
                currency: settings.currency.currency,
                notes: settings.invoice.notesAndTerms,
                status: 'draft'
            };

            // Use the existing API setup for authentication
            const response = await fetch('http://localhost:7001/api/invoices/preview-pdf', {
                method: 'POST',
                credentials: 'include', // Include session cookies
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    invoice: sampleInvoice,
                    settings: settings
                })
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
            } else {
                setMessage('Failed to generate preview. Please try again.');
            }
        } catch (error) {
            console.error('Error generating preview:', error);
            setMessage('Failed to generate preview. Please try again.');
        } finally {
            setPreviewLoading(false);
        }
    };

    const isTrusted = getTrustedDevices(user.user || user.username);

    const tabs = [
        { id: 'business', label: 'Business Info', icon: Briefcase },
        { id: 'currency', label: 'Currency', icon: DollarSign },
        { id: 'tax', label: 'Tax', icon: Percent },
        { id: 'payment', label: 'Payment', icon: Clock },
        { id: 'invoice', label: 'Invoice', icon: FileText },
        { id: 'pdf', label: 'PDF Settings', icon: File },
        { id: 'theme', label: 'Theme', icon: Palette }
    ];

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Settings</h1>
                <p className="text-gray-600">Manage your business and invoice settings</p>
            </div>

            {message && (
                <div className={`mb-6 p-4 border rounded-lg ${message.includes('success') ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <p className={message.includes('success') ? 'text-green-800' : 'text-red-800'}>{message}</p>
                </div>
            )}

            {/* Tabs */}
            <div className="mb-8 border-b border-slate-200 overflow-x-auto">
                <div className="flex gap-1 pb-2">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg whitespace-nowrap transition-colors text-sm font-semibold border-b-2 ${
                                activeTab === tab.id
                                    ? 'text-teal-700 border-teal-600 bg-teal-50/50'
                                    : 'text-slate-600 border-transparent hover:text-teal-700 hover:bg-slate-50'
                            }`}
                        >
                            <Icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    );
                })}
                </div>
            </div>

            <div className="grid gap-6">
                {/* Business Info Tab */}
                {activeTab === 'business' && (
                    <Card className="pt-2">
                        <CardHeader>
                            <CardTitle>Business Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
                                <Input
                                    value={settings.businessInfo.businessName}
                                    onChange={(e) => handleInputChange('businessInfo', 'businessName', e.target.value)}
                                    placeholder="Your Business Name"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <Input
                                        type="email"
                                        value={settings.businessInfo.email}
                                        onChange={(e) => handleInputChange('businessInfo', 'email', e.target.value)}
                                        placeholder="contact@business.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                    <Input
                                        value={settings.businessInfo.phone}
                                        onChange={(e) => handleInputChange('businessInfo', 'phone', e.target.value)}
                                        placeholder="+1 123 456 7890"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                <textarea
                                    value={settings.businessInfo.address}
                                    onChange={(e) => handleInputChange('businessInfo', 'address', e.target.value)}
                                    placeholder="Street Address, City, Country"
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                                <Input
                                    value={settings.businessInfo.website}
                                    onChange={(e) => handleInputChange('businessInfo', 'website', e.target.value)}
                                    placeholder="https://www.example.com"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Business Logo (PDF top-left)</label>
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleImageUpload('businessInfo', 'logo', e.target.files?.[0])}
                                    />
                                    {settings.businessInfo.logo && (
                                        <img src={settings.businessInfo.logo} alt="Business logo preview" className="mt-2 h-14 w-auto border rounded" />
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Signature Image (PDF bottom-right)</label>
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleImageUpload('signature', 'image', e.target.files?.[0])}
                                    />
                                    {settings.signature?.image && (
                                        <img src={settings.signature.image} alt="Signature preview" className="mt-2 h-14 w-auto border rounded" />
                                    )}
                                    <Input
                                        className="mt-2"
                                        value={settings.signature?.name || ''}
                                        onChange={(e) => handleInputChange('signature', 'name', e.target.value)}
                                        placeholder="Signature name (optional)"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Currency Tab */}
                {activeTab === 'currency' && (
                    <Card className="pt-2">
                        <CardHeader>
                            <CardTitle>Currency Settings</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Currency Code</label>
                                    <select
                                        value={settings.currency.currency}
                                        onChange={(e) => handleInputChange('currency', 'currency', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    >
                                        <option value="USD">USD - US Dollar</option>
                                        <option value="EUR">EUR - Euro</option>
                                        <option value="GBP">GBP - British Pound</option>
                                        <option value="INR">INR - Indian Rupee</option>
                                        <option value="JPY">JPY - Japanese Yen</option>
                                        <option value="AUD">AUD - Australian Dollar</option>
                                        <option value="CAD">CAD - Canadian Dollar</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Currency Symbol</label>
                                    <Input
                                        value={settings.currency.symbol}
                                        onChange={(e) => handleInputChange('currency', 'symbol', e.target.value)}
                                        placeholder="$"
                                        maxLength={3}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Tax Tab */}
                {activeTab === 'tax' && (
                    <Card className="pt-2">
                        <CardHeader>
                            <CardTitle>Tax Settings</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Default Tax Rate (%)</label>
                                    <Input
                                        type="number"
                                        value={settings.tax.defaultTaxRate}
                                        onChange={(e) => handleInputChange('tax', 'defaultTaxRate', parseFloat(e.target.value))}
                                        placeholder="0"
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tax Name</label>
                                    <Input
                                        value={settings.tax.taxName}
                                        onChange={(e) => handleInputChange('tax', 'taxName', e.target.value)}
                                        placeholder="Tax, GST, VAT, etc."
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Payment Tab */}
                {activeTab === 'payment' && (
                    <Card className="pt-2">
                        <CardHeader>
                            <CardTitle>Payment Settings</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Default Payment Deadline (Days)</label>
                                <Input
                                    type="number"
                                    value={settings.payment.defaultPaymentDeadlineDays}
                                    onChange={(e) => handleInputChange('payment', 'defaultPaymentDeadlineDays', parseInt(e.target.value))}
                                    placeholder="30"
                                    min="1"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Default Payment Terms</label>
                                <textarea
                                    value={settings.payment.defaultPaymentTerms}
                                    onChange={(e) => handleInputChange('payment', 'defaultPaymentTerms', e.target.value)}
                                    placeholder="e.g., Due upon receipt, Net 30, etc."
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Invoice Tab */}
                {activeTab === 'invoice' && (
                    <Card className="pt-2">
                        <CardHeader>
                            <CardTitle>Invoice Settings</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number Format</label>
                                <Input
                                    value={settings.invoice.numberFormat}
                                    onChange={(e) => handleInputChange('invoice', 'numberFormat', e.target.value)}
                                    placeholder="INV-{YYYY}{MM}{DD}-{###}"
                                />
                                <p className="text-sm text-gray-500 mt-1">{'{YYYY}'} = Year, {'{MM}'} = Month, {'{DD}'} = Day, {'{###}'} = Sequential</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Default Notes & Terms</label>
                                <textarea
                                    value={settings.invoice.notesAndTerms}
                                    onChange={(e) => handleInputChange('invoice', 'notesAndTerms', e.target.value)}
                                    placeholder="Thank you for your business!"
                                    rows={4}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* PDF Tab */}
                {activeTab === 'pdf' && (
                    <Card className="pt-2">
                        <CardHeader>
                            <CardTitle>PDF Settings</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Paper Size</label>
                                    <select
                                        value={settings.pdf.paperSize}
                                        onChange={(e) => handleInputChange('pdf', 'paperSize', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    >
                                        <option value="A4">A4</option>
                                        <option value="Letter">Letter</option>
                                        <option value="Legal">Legal</option>
                                        <option value="A3">A3</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Orientation</label>
                                    <select
                                        value={settings.pdf.orientation}
                                        onChange={(e) => handleInputChange('pdf', 'orientation', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    >
                                        <option value="portrait">Portrait</option>
                                        <option value="landscape">Landscape</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Font Family</label>
                                <select
                                    value={settings.pdf.fontFamily}
                                    onChange={(e) => handleInputChange('pdf', 'fontFamily', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                >
                                    <option value="Helvetica">Helvetica</option>
                                    <option value="Times-Roman">Times Roman</option>
                                    <option value="Courier">Courier</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Font Size</label>
                                    <Input
                                        type="number"
                                        value={settings.pdf.fontSize}
                                        onChange={(e) => handleInputChange('pdf', 'fontSize', parseInt(e.target.value))}
                                        placeholder="12"
                                        min="8"
                                        max="24"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Show Logo</label>
                                    <div className="flex items-center mt-2">
                                        <input
                                            type="checkbox"
                                            checked={settings.pdf.showLogo}
                                            onChange={(e) => handleInputChange('pdf', 'showLogo', e.target.checked)}
                                            className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                                        />
                                        <label className="ml-2 text-sm text-gray-700">Include business logo in PDFs</label>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <h3 className="text-lg font-medium text-gray-900 mb-3">Margins (in points)</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Top Margin</label>
                                        <Input
                                            type="number"
                                            value={settings.pdf.marginTop}
                                            onChange={(e) => handleInputChange('pdf', 'marginTop', parseInt(e.target.value))}
                                            placeholder="50"
                                            min="0"
                                            max="200"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Bottom Margin</label>
                                        <Input
                                            type="number"
                                            value={settings.pdf.marginBottom}
                                            onChange={(e) => handleInputChange('pdf', 'marginBottom', parseInt(e.target.value))}
                                            placeholder="50"
                                            min="0"
                                            max="200"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Left Margin</label>
                                        <Input
                                            type="number"
                                            value={settings.pdf.marginLeft}
                                            onChange={(e) => handleInputChange('pdf', 'marginLeft', parseInt(e.target.value))}
                                            placeholder="50"
                                            min="0"
                                            max="200"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Right Margin</label>
                                        <Input
                                            type="number"
                                            value={settings.pdf.marginRight}
                                            onChange={(e) => handleInputChange('pdf', 'marginRight', parseInt(e.target.value))}
                                            placeholder="50"
                                            min="0"
                                            max="200"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <h3 className="text-lg font-medium text-gray-900 mb-3">Watermark</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={settings.pdf.showWatermark}
                                            onChange={(e) => handleInputChange('pdf', 'showWatermark', e.target.checked)}
                                            className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                                        />
                                        <label className="ml-2 text-sm text-gray-700">Show watermark on PDFs</label>
                                    </div>
                                    {settings.pdf.showWatermark && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Watermark Text</label>
                                            <Input
                                                value={settings.pdf.watermarkText}
                                                onChange={(e) => handleInputChange('pdf', 'watermarkText', e.target.value)}
                                                placeholder="DRAFT"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Theme Tab */}
                {activeTab === 'theme' && (
                    <Card className="pt-2">
                        <CardHeader>
                            <CardTitle>Theme Settings</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Template</label>
                                <select
                                    value={settings.theme.template}
                                    onChange={(e) => handleInputChange('theme', 'template', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                >
                                    <option value="modern">Modern</option>
                                    <option value="classic">Classic</option>
                                    <option value="minimal">Minimal</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={settings.theme.primaryColor}
                                            onChange={(e) => handleInputChange('theme', 'primaryColor', e.target.value)}
                                            className="h-10 w-20 border border-gray-300 rounded"
                                        />
                                        <Input
                                            value={settings.theme.primaryColor}
                                            onChange={(e) => handleInputChange('theme', 'primaryColor', e.target.value)}
                                            placeholder="#3B82F6"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Accent Color</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={settings.theme.accentColor}
                                            onChange={(e) => handleInputChange('theme', 'accentColor', e.target.value)}
                                            className="h-10 w-20 border border-gray-300 rounded"
                                        />
                                        <Input
                                            value={settings.theme.accentColor}
                                            onChange={(e) => handleInputChange('theme', 'accentColor', e.target.value)}
                                            placeholder="#1E40AF"
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Security Tab */}
                {activeTab === 'security' && (
                    <Card className="pt-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5" />
                                Device Security
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-blue-900">Current Device Status</p>
                                        <p className="text-sm text-blue-800 mt-1">
                                            This device is <strong>{isTrusted ? 'trusted' : 'not trusted'}</strong> for 2FA
                                        </p>
                                    </div>
                                </div>
                            </div>
                            {isTrusted && (
                                <p className="text-sm text-gray-600">
                                    This device has been marked as trusted. You can log out from this device to require 2FA verification again.
                                </p>
                            )}
                            <Button
                                variant="destructive"
                                onClick={() => setConfirmLogoutAll(true)}
                                className="w-full"
                            >
                                <LogOut className="h-4 w-4 mr-2" />
                                Logout From All Devices
                            </Button>
                            {confirmLogoutAll && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-red-800 font-medium mb-3">Are you sure? This will log you out from all devices.</p>
                                    <div className="flex gap-2">
                                        <Button variant="destructive" onClick={handleLogoutAllDevices}>
                                            Confirm Logout
                                        </Button>
                                        <Button variant="outline" onClick={() => setConfirmLogoutAll(false)}>
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 mt-4 border-t">
                                <h3 className="font-semibold text-gray-900 mb-3">Account Information</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm text-gray-600">Username</label>
                                        <p className="text-lg font-semibold text-gray-900">{user?.username}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm text-gray-600">2FA Status</label>
                                        <p className="text-lg font-semibold text-green-600">
                                            {user?.isMfaActive ? '✓ Enabled' : '✗ Disabled'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Save Button */}
            {activeTab !== 'security' && (
                <div className="mt-6 flex justify-end gap-4">
                    <Button
                        variant="outline"
                        onClick={generatePreview}
                        disabled={previewLoading}
                        className="flex items-center gap-2"
                    >
                        <Eye className="h-4 w-4" />
                        {previewLoading ? 'Generating Preview...' : 'Preview Invoice'}
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                        <Save className="h-4 w-4 mr-2" />
                        {loading ? 'Saving...' : 'Save Settings'}
                    </Button>
                </div>
            )}
        </div>
    );
};

export default Settings;
