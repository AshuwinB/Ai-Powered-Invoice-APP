import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { invoiceApi, settingsApi } from '../service/invoiceApi';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import { ArrowLeft, Plus, Trash2, Sparkles, X, Loader2 } from 'lucide-react';

const CreateEditInvoice = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const isEditing = !!id;
    const cloneFromId = searchParams.get('clone');

    const [formData, setFormData] = useState({
        invoice_no: '',
        invoice_date: '',
        due_date: '',
        currency: 'USD',
        from: {
            name: '',
            email: '',
            address1: '',
            address2: '',
            address3: ''
        },
        to: {
            name: '',
            email: '',
            address1: '',
            address2: '',
            address3: '',
            city: '',
            state: '',
            postal_code: ''
        },

        items: [{ item_name: '', quantity: 1, price: 0, total: 0 }],
        sub_total: 0,
        discount: 0,
        tax_percentage: 0,
        total: 0,
        notes: '',
        status: 'UNPAID'
    });

    const [loading, setLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [businessInfoDefaults, setBusinessInfoDefaults] = useState({
        name: '',
        email: '',
        address1: '',
    });
    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState('');
    const [aiDraftData, setAiDraftData] = useState(null);
    const [aiMissingFields, setAiMissingFields] = useState([]);

    useEffect(() => {
        const { subTotal, total } = calculateTotals(formData.items, formData.discount, formData.tax_percentage);
        if (formData.sub_total !== subTotal || formData.total !== total) {
            setFormData((prev) => ({ ...prev, sub_total: subTotal, total }));
        }
    }, [formData.items, formData.discount, formData.tax_percentage]);

    useEffect(() => {
        const fetchSettingsAndSetup = async () => {
            try {
                // Load default settings
                const settingsResponse = await settingsApi.getSettings();
                const defaultSettings = settingsResponse.data;
                const defaultsFromSettings = {
                    name: defaultSettings?.businessInfo?.businessName || '',
                    email: defaultSettings?.businessInfo?.email || '',
                    address1: defaultSettings?.businessInfo?.address || '',
                };
                setBusinessInfoDefaults(defaultsFromSettings);
                const cloneId = searchParams.get('clone');

                if (isEditing) {
                    const response = await invoiceApi.getInvoice(id);
                    const invoice = response.data;
                    setFormData({
                        ...invoice,
                        invoice_date: new Date(invoice.invoice_date).toISOString().split('T')[0],
                        due_date: new Date(invoice.due_date).toISOString().split('T')[0]
                    });
                } else if (cloneId) {
                    const cloneResponse = await invoiceApi.getInvoice(cloneId);
                    const source = cloneResponse.data;
                    const today = new Date();
                    const dueDate = new Date();
                    dueDate.setDate(dueDate.getDate() + (defaultSettings?.payment?.defaultPaymentDeadlineDays || 30));
                    const invoiceNo = `INV-${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

                    setFormData((prev) => ({
                        ...prev,
                        ...source,
                        from: withBusinessInfoDefaults(source.from || prev.from || {}, defaultsFromSettings),
                        invoice_no: invoiceNo,
                        invoice_date: today.toISOString().split('T')[0],
                        due_date: dueDate.toISOString().split('T')[0],
                        status: 'UNPAID',
                        payment_link: null,
                        payment_id: null,
                        qr_code: null,
                    }));
                } else {
                    // Generate invoice number for new invoices
                    const today = new Date();
                    const invoiceNo = `INV-${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
                    
                    // Calculate due date based on default payment deadline
                    const dueDate = new Date();
                    dueDate.setDate(dueDate.getDate() + (defaultSettings?.payment?.defaultPaymentDeadlineDays || 30));
                    
                    setFormData(prev => ({
                        ...prev,
                        invoice_no: invoiceNo,
                        currency: defaultSettings?.currency?.currency || 'USD',
                        tax_percentage: defaultSettings?.tax?.defaultTaxRate || 0,
                        notes: defaultSettings?.invoice?.notesAndTerms || '',
                        from: withBusinessInfoDefaults({
                            name: defaultSettings?.businessInfo?.businessName || '',
                            email: defaultSettings?.businessInfo?.email || '',
                            address1: defaultSettings?.businessInfo?.address || '',
                            address2: '',
                            address3: ''
                        }, defaultsFromSettings),
                        due_date: dueDate.toISOString().split('T')[0]
                    }));
                }
            } catch (error) {
                console.error('Error fetching settings:', error);
                // Fallback if settings fail to load
                if (!isEditing) {
                    const today = new Date();
                    const invoiceNo = `INV-${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
                    setFormData(prev => ({ ...prev, invoice_no: invoiceNo }));
                }
            }
        };

        fetchSettingsAndSetup();
    }, [id, isEditing, searchParams]);

    useEffect(() => {
        if (isEditing) return;
        if (searchParams.get('mode') === 'ai') {
            setAiModalOpen(true);
        }
    }, [isEditing, searchParams]);

    const getCurrencySymbol = (currencyCode) => {
        const map = {
            inr: '₹',
            usd: '$',
            eur: '€',
            gbp: '£',
            aud: 'A$',
            cad: 'C$',
            jpy: '¥'
        };
        if (!currencyCode) return '$';
        return map[currencyCode.toLowerCase()] || '$';
    };

    const calculateTotals = (items, discount = 0, taxPercentage = 0) => {
        const subTotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
        const discountAmount = discount;
        const taxableAmount = subTotal - discountAmount;
        const taxAmount = (taxableAmount * taxPercentage) / 100;
        const total = taxableAmount + taxAmount;

        return { subTotal, total };
    };

    const withBusinessInfoDefaults = (fromData = {}, defaults = businessInfoDefaults) => ({
        ...fromData,
        name: String(fromData.name || '').trim() || String(defaults.name || '').trim(),
        email: String(fromData.email || '').trim() || String(defaults.email || '').trim(),
        address1: String(fromData.address1 || '').trim() || String(defaults.address1 || '').trim(),
    });

    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index][field] = value;

        if (field === 'quantity' || field === 'price') {
            newItems[index].total = newItems[index].quantity * newItems[index].price;
        }

        const { subTotal, total } = calculateTotals(newItems, formData.discount, formData.tax_percentage);

        setFormData({
            ...formData,
            items: newItems,
            sub_total: subTotal,
            total: total
        });
    };

    const addItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { item_name: '', quantity: 1, price: 0, total: 0 }]
        });
    };

    const removeItem = (index) => {
        if (formData.items.length > 1) {
            const newItems = formData.items.filter((_, i) => i !== index);
            const { subTotal, total } = calculateTotals(newItems, formData.discount, formData.tax_percentage);

            setFormData({
                ...formData,
                items: newItems,
                sub_total: subTotal,
                total: total
            });
        }
    };

    const buildSubmitData = (sourceData) => {
        const todayISO = new Date().toISOString().split('T')[0];
        const invoiceDateISO = sourceData.invoice_date || todayISO;
        const dueDateISO = sourceData.due_date || todayISO;
        const { subTotal, total } = calculateTotals(
            sourceData.items,
            sourceData.discount,
            sourceData.tax_percentage
        );

        const {
            _id,
            userId,
            createdAt,
            updatedAt,
            __v,
            payment_confirmation_email_sent_at,
            ...safeSourceData
        } = sourceData;

        return {
            ...safeSourceData,
            sub_total: subTotal,
            total,
            invoice_date: new Date(invoiceDateISO),
            due_date: new Date(dueDateISO)
        };
    };

    const getMissingFieldDefs = (data) => {
        const missing = [];
        if (!data.from?.name) missing.push({ key: 'from.name', label: 'Your name' });
        if (!data.from?.email) missing.push({ key: 'from.email', label: 'Your email' });
        if (!data.from?.address1) missing.push({ key: 'from.address1', label: 'Your address' });
        if (!data.to?.name) missing.push({ key: 'to.name', label: 'Client name' });
        if (!data.to?.email) missing.push({ key: 'to.email', label: 'Client email' });
        if (!data.to?.address1) missing.push({ key: 'to.address1', label: 'Client address' });
        if (!data.items?.length || !data.items[0]?.item_name) {
            missing.push({ key: 'items.0.item_name', label: 'First item name' });
        }
        return missing;
    };

    const isFilled = (value) => {
        if (typeof value === 'string') return value.trim().length > 0;
        return value !== null && value !== undefined;
    };

    const mergePreservingExisting = (base = {}, incoming = {}) => {
        const merged = { ...base };
        Object.keys(incoming || {}).forEach((key) => {
            if (isFilled(incoming[key])) {
                merged[key] = incoming[key];
            }
        });
        return merged;
    };

    const normalizeAddress = (entity = {}) => {
        const next = { ...entity };
        const candidateAddress = String(
            next.address1
            || next.address
            || next.location
            || next.street
            || ''
        ).trim();

        if (!next.address1 && candidateAddress) {
            next.address1 = candidateAddress;
        }

        if (!next.address1) {
            const fallback = [next.city, next.state, next.postal_code].filter(Boolean).join(', ').trim();
            if (fallback) {
                next.address1 = fallback;
            }
        }

        return next;
    };

    const updateAiDraftField = (fieldKey, value) => {
        setAiDraftData(prev => {
            if (!prev) return prev;

            const next = { ...prev };

            if (fieldKey === 'from.name') next.from = { ...next.from, name: value };
            if (fieldKey === 'from.email') next.from = { ...next.from, email: value };
            if (fieldKey === 'from.address1') next.from = { ...next.from, address1: value };
            if (fieldKey === 'to.name') next.to = { ...next.to, name: value };
            if (fieldKey === 'to.email') next.to = { ...next.to, email: value };
            if (fieldKey === 'to.address1') next.to = { ...next.to, address1: value };
            if (fieldKey === 'items.0.item_name') {
                const items = Array.isArray(next.items) && next.items.length > 0
                    ? [...next.items]
                    : [{ item_name: '', quantity: 1, price: 0, total: 0 }];
                items[0] = { ...items[0], item_name: value };
                next.items = items;
            }

            const { subTotal, total } = calculateTotals(next.items, next.discount, next.tax_percentage);
            next.sub_total = subTotal;
            next.total = total;
            // Keep the missing-field list stable while typing so inputs don't disappear and steal focus.
            return next;
        });
    };

    const resetAiModalState = () => {
        setAiPrompt('');
        setAiError('');
        setAiDraftData(null);
        setAiMissingFields([]);
    };

    const handleAiSkipToForm = () => {
        if (aiDraftData) {
            setFormData(aiDraftData);
        }
        setAiModalOpen(false);
        resetAiModalState();
    };

    const handleAiSaveAfterMissing = async () => {
        if (!aiDraftData) return;

        const missing = getMissingFieldDefs(aiDraftData);
        if (missing.length > 0) {
            setAiMissingFields(missing);
            setAiError('Please fill the required fields below, or skip to invoice form.');
            return;
        }

        setAiLoading(true);
        setAiError('');
        try {
            const submitData = buildSubmitData(aiDraftData);
            await invoiceApi.createInvoice(submitData);
            setAiModalOpen(false);
            resetAiModalState();
            navigate('/invoices');
        } catch (err) {
            setAiError(err.response?.data?.message || 'Could not save invoice. Please try again.');
        } finally {
            setAiLoading(false);
        }
    };

    const handleAiGenerate = async () => {
        if (!aiPrompt.trim()) return;
        setAiLoading(true);
        setAiError('');
        try {
            let effectiveBusinessDefaults = businessInfoDefaults;
            try {
                const settingsResponse = await settingsApi.getSettings();
                effectiveBusinessDefaults = {
                    name: settingsResponse?.data?.businessInfo?.businessName || businessInfoDefaults.name || '',
                    email: settingsResponse?.data?.businessInfo?.email || businessInfoDefaults.email || '',
                    address1: settingsResponse?.data?.businessInfo?.address || businessInfoDefaults.address1 || '',
                };
                setBusinessInfoDefaults(effectiveBusinessDefaults);
            } catch (settingsError) {
                // Continue with cached defaults when settings fetch is temporarily unavailable.
            }

            const response = await invoiceApi.generateInvoiceFromAI(aiPrompt);
            const ai = response.data.invoiceData;
            const today = new Date();
            const fallbackDueDate = new Date(today);
            fallbackDueDate.setDate(today.getDate() + 30);
            const generatedInvoiceNo = formData.invoice_no || `INV-${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
            const mergedData = {
                ...formData,
                invoice_no: generatedInvoiceNo,
                invoice_date: formData.invoice_date || today.toISOString().split('T')[0],
                due_date: formData.due_date || fallbackDueDate.toISOString().split('T')[0],
                from: withBusinessInfoDefaults(
                    normalizeAddress(mergePreservingExisting(formData.from, ai.from || {})),
                    effectiveBusinessDefaults
                ),
                to: normalizeAddress(mergePreservingExisting(formData.to, ai.to || {})),
                items: ai.items?.length ? ai.items : formData.items,
                discount: ai.discount ?? formData.discount,
                tax_percentage: ai.tax_percentage ?? formData.tax_percentage,
                notes: ai.notes || formData.notes,
                currency: ai.currency || formData.currency,
            };

            const { subTotal, total } = calculateTotals(
                mergedData.items,
                mergedData.discount,
                mergedData.tax_percentage
            );

            const completedFormData = {
                ...mergedData,
                sub_total: subTotal,
                total
            };

            const missing = getMissingFieldDefs(completedFormData);
            if (missing.length > 0) {
                setAiDraftData(completedFormData);
                setAiMissingFields(missing);
                setAiError('Some required fields are missing. Fill them below or skip to invoice form.');
                return;
            }

            const submitData = buildSubmitData(completedFormData);
            await invoiceApi.createInvoice(submitData);

            setAiModalOpen(false);
            resetAiModalState();
            navigate('/invoices');
        } catch (err) {
            setAiError(err.response?.data?.message || 'AI generation failed. Please try again.');
        } finally {
            setAiLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!formData.invoice_date || !formData.due_date) {
            setFormError('Invoice date and due date are required.');
            return;
        }

        if (new Date(formData.due_date) < new Date(formData.invoice_date)) {
            setFormError('Due date must be on or after invoice date.');
            return;
        }

        if ((formData.items || []).some((item) => !String(item.item_name || '').trim())) {
            setFormError('Each item needs a name.');
            return;
        }

        if ((formData.items || []).some((item) => Number(item.quantity) <= 0)) {
            setFormError('Each item quantity must be greater than 0.');
            return;
        }

        if ((formData.items || []).some((item) => Number(item.price) < 0)) {
            setFormError('Item prices cannot be negative.');
            return;
        }

        if (Number(formData.discount) > Number(formData.sub_total)) {
            setFormError('Discount cannot be greater than subtotal.');
            return;
        }

        setLoading(true);

        try {
            const submitData = buildSubmitData(formData);

            console.log('Submitting invoice data:', submitData);

            if (isEditing) {
                await invoiceApi.updateInvoice(id, submitData);
            } else {
                const response = await invoiceApi.createInvoice(submitData, cloneFromId ? { cloneFrom: cloneFromId } : undefined);
                console.log('Create invoice response:', response);
            }

            navigate('/invoices');
        } catch (error) {
            console.error('Error saving invoice:', error);
            alert('Error saving invoice: ' + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center gap-4 mb-8">
                <Button variant="outline" onClick={() => navigate('/invoices')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <h1 className="text-3xl font-bold flex-1">
                    {isEditing ? 'Edit Invoice' : 'Create Invoice'}
                </h1>
                {!isEditing && (
                    <button
                        type="button"
                        onClick={() => {
                            setAiModalOpen(true);
                            resetAiModalState();
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm bg-linear-to-r from-violet-600 to-indigo-500 hover:opacity-90 text-white shadow-md transition-opacity"
                    >
                        <Sparkles className="h-4 w-4" />
                        Create with AI
                    </button>
                )}
            </div>

            {/* AI Modal */}
            {aiModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-violet-600" />
                                <h2 className="text-lg font-semibold text-slate-800">Create Invoice with AI</h2>
                            </div>
                            <button
                                onClick={() => {
                                    setAiModalOpen(false);
                                    resetAiModalState();
                                }}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="px-6 py-4">
                            {aiMissingFields.length === 0 ? (
                                <>
                                    <p className="text-sm text-slate-500 mb-3">
                                        Describe the invoice in plain English. AI will extract details, create, and save the invoice automatically.
                                    </p>
                                    <p className="text-xs text-slate-400 mb-2 italic">
                                        India example: &ldquo;Create INR invoice for Rahul Sharma, rahul@gmail.com, Bengaluru Karnataka 560001. 2 logo designs at 2500 each and 1 revision at 1000. Add 18% GST.&rdquo;
                                    </p>
                                    <p className="text-xs text-slate-400 mb-3 italic">
                                        Another example: &ldquo;Invoice for Priya Enterprises, Mumbai Maharashtra 400001, bookkeeping services 12 hours at ₹800 per hour, discount ₹500, currency INR.&rdquo;
                                    </p>
                                    <p className="text-xs text-slate-500 mb-3">
                                        Best results: include your name/email/address, client name/email/address, at least one item, currency, and tax/GST.
                                    </p>
                                    <textarea
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400 min-h-[120px] resize-none transition"
                                        placeholder="Describe the invoice..."
                                        value={aiPrompt}
                                        onChange={e => setAiPrompt(e.target.value)}
                                        maxLength={2000}
                                        disabled={aiLoading}
                                    />
                                    <p className="text-xs text-slate-400 text-right mt-1">{aiPrompt.length}/2000</p>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm font-medium text-amber-700 mb-1">AI needs a few required fields before saving.</p>
                                    <p className="text-xs text-slate-500 mb-3">Fill below and save, or skip to invoice form and complete there.</p>
                                    <div className="space-y-3">
                                        {aiMissingFields.map((field) => {
                                            const fieldValue = field.key === 'from.name' ? aiDraftData?.from?.name || ''
                                                : field.key === 'from.email' ? aiDraftData?.from?.email || ''
                                                : field.key === 'from.address1' ? aiDraftData?.from?.address1 || ''
                                                : field.key === 'to.name' ? aiDraftData?.to?.name || ''
                                                : field.key === 'to.email' ? aiDraftData?.to?.email || ''
                                                : field.key === 'to.address1' ? aiDraftData?.to?.address1 || ''
                                                : aiDraftData?.items?.[0]?.item_name || '';

                                            return (
                                                <div key={field.key}>
                                                    <label className="block text-xs font-medium text-slate-600 mb-1">{field.label}</label>
                                                    <Input
                                                        type={field.key.includes('email') ? 'email' : 'text'}
                                                        value={fieldValue}
                                                        onChange={(e) => updateAiDraftField(field.key, e.target.value)}
                                                        placeholder={`Enter ${field.label.toLowerCase()}`}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                            {aiError && (
                                <p className="text-sm text-rose-600 mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">{aiError}</p>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 px-6 pb-6">
                            <button
                                type="button"
                                onClick={() => {
                                    setAiModalOpen(false);
                                    resetAiModalState();
                                }}
                                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition"
                            >
                                Cancel
                            </button>
                            {aiMissingFields.length > 0 && (
                                <button
                                    type="button"
                                    onClick={handleAiSkipToForm}
                                    disabled={aiLoading}
                                    className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                    Skip to Invoice Form
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={aiMissingFields.length > 0 ? handleAiSaveAfterMissing : handleAiGenerate}
                                disabled={aiLoading || (aiMissingFields.length === 0 && !aiPrompt.trim())}
                                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-linear-to-r from-violet-600 to-indigo-500 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                            >
                                {aiLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : <><Sparkles className="h-4 w-4" /> {aiMissingFields.length > 0 ? 'Save Invoice' : 'Generate and Save'}</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit}>
                {formError && (
                    <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {formError}
                    </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Invoice Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Invoice Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Invoice Number</label>
                                <Input
                                    value={formData.invoice_no}
                                    onChange={(e) => setFormData({ ...formData, invoice_no: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Invoice Date</label>
                                    <Input
                                        type="date"
                                        value={formData.invoice_date}
                                        onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Due Date</label>
                                    <Input
                                        type="date"
                                        value={formData.due_date}
                                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Currency</label>
                                <select
                                    value={formData.currency}
                                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                    className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                    <option value="GBP">GBP</option>
                                    <option value="INR">INR</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Status</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="UNPAID">UNPAID</option>
                                    <option value="PAID">PAID</option>
                                    <option value="CANCEL">CANCEL</option>
                                </select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* From (Your Details) */}
                    <Card>
                        <CardHeader>
                            <CardTitle>From (Your Details)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Input
                                placeholder="Your Name"
                                value={formData.from.name}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    from: { ...formData.from, name: e.target.value }
                                })}
                                required
                            />
                            <Input
                                type="email"
                                placeholder="Your Email"
                                value={formData.from.email}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    from: { ...formData.from, email: e.target.value }
                                })}
                                required
                            />
                            <Input
                                placeholder="Address Line 1"
                                value={formData.from.address1}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    from: { ...formData.from, address1: e.target.value }
                                })}
                                required
                            />
                            <Input
                                placeholder="Address Line 2"
                                value={formData.from.address2}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    from: { ...formData.from, address2: e.target.value }
                                })}
                            />
                            <Input
                                placeholder="Address Line 3"
                                value={formData.from.address3}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    from: { ...formData.from, address3: e.target.value }
                                })}
                            />
                        </CardContent>
                    </Card>

                    {/* To (Client Details) */}
                    <Card>
                        <CardHeader>
                            <CardTitle>To (Client Details)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Input
                                placeholder="Client Name"
                                value={formData.to.name}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    to: { ...formData.to, name: e.target.value }
                                })}
                                required
                            />
                            <Input
                                type="email"
                                placeholder="Client Email"
                                value={formData.to.email}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    to: { ...formData.to, email: e.target.value }
                                })}
                                required
                            />
                            <Input
                                placeholder="Address Line 1"
                                value={formData.to.address1}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    to: { ...formData.to, address1: e.target.value }
                                })}
                                required
                            />
                            <Input
                                placeholder="Address Line 2"
                                value={formData.to.address2}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    to: { ...formData.to, address2: e.target.value }
                                })}
                            />
                            <Input
                                placeholder="Address Line 3"
                                value={formData.to.address3}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    to: { ...formData.to, address3: e.target.value }
                                })}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">City</label>
                                    <Input
                                        placeholder="City"
                                        value={formData.to.city}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            to: { ...formData.to, city: e.target.value }
                                        })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">State</label>
                                    <Input
                                        placeholder="State"
                                        value={formData.to.state}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            to: { ...formData.to, state: e.target.value }
                                        })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Postal Code</label>
                                <Input
                                    placeholder="Postal Code"
                                    value={formData.to.postal_code}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        to: { ...formData.to, postal_code: e.target.value }
                                    })}
                                />
                            </div>
                        </CardContent>

                    </Card>

                    {/* Items */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Items</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {formData.items.map((item, index) => (
                                    <div key={index} className="border rounded p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium mb-1">Item Name</label>
                                                <Input
                                                    placeholder="Item name"
                                                    value={item.item_name}
                                                    onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Qty</label>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    value={item.quantity}
                                                    onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Price</label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={item.price}
                                                    onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                                                    required
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <label className="block text-sm font-medium mb-1">Total</label>
                                                    <Input
                                                        value={`${getCurrencySymbol(formData.currency)}${item.total.toFixed(2)}`}
                                                        readOnly
                                                    />
                                                </div>
                                                {formData.items.length > 1 && (
                                                    <Button
                                                        type="button"
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => removeItem(index)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <Button type="button" variant="outline" onClick={addItem}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Item
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Summary */}
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle>Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Discount ($)</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.discount}
                                        onChange={(e) => {
                                            const discount = parseFloat(e.target.value) || 0;
                                            const { subTotal, total } = calculateTotals(formData.items, discount, formData.tax_percentage);
                                            setFormData({
                                                ...formData,
                                                discount,
                                                sub_total: subTotal,
                                                total: total
                                            });
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Tax (%)</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.tax_percentage}
                                        onChange={(e) => {
                                            const taxPercentage = parseFloat(e.target.value) || 0;
                                            const { subTotal, total } = calculateTotals(formData.items, formData.discount, taxPercentage);
                                            setFormData({
                                                ...formData,
                                                tax_percentage: taxPercentage,
                                                sub_total: subTotal,
                                                total: total
                                            });
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span>Subtotal:</span>
                                        <span>{getCurrencySymbol(formData.currency)}{formData.sub_total.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Discount:</span>
                                        <span>-{getCurrencySymbol(formData.currency)}{formData.discount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Tax ({formData.tax_percentage}%):</span>
                                        <span>{getCurrencySymbol(formData.currency)}{((formData.sub_total - formData.discount) * formData.tax_percentage / 100).toFixed(2)}</span>
                                    </div>
                                    <hr />
                                    <div className="flex justify-between font-bold text-lg">
                                        <span>Total:</span>
                                        <span>{getCurrencySymbol(formData.currency)}{formData.total.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6">
                            <label className="block text-sm font-medium mb-1">Notes</label>
                            <textarea
                                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                                placeholder="Additional notes..."
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            />
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-4 mt-6">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate('/invoices')}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Saving...' : (isEditing ? 'Update Invoice' : 'Create Invoice')}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default CreateEditInvoice;