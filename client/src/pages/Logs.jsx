import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileClock, RefreshCw } from 'lucide-react';
import Button from '../components/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { getActivityLogs } from '../service/authApi';

const Logs = () => {
    const navigate = useNavigate();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadLogs = async () => {
        try {
            setLoading(true);
            const data = await getActivityLogs(300);
            setLogs(data || []);
        } catch (error) {
            console.error('Failed loading logs:', error);
            setLogs([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLogs();
    }, []);

    const invoiceLogs = useMemo(() => {
        return logs.filter((log) => {
            const action = String(log.action || '');
            return log.category === 'invoice' || action.startsWith('INVOICE_');
        });
    }, [logs]);

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 page-enter">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={() => navigate('/home')}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Invoice Logs</h1>
                        <p className="text-slate-600 mt-1">Timeline of invoice create, update, delete and email activities.</p>
                    </div>
                </div>
                <Button variant="outline" onClick={loadLogs}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileClock className="h-5 w-5 text-teal-600" />
                        Activity Feed
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-slate-500 py-6 text-center">Loading logs...</p>
                    ) : invoiceLogs.length === 0 ? (
                        <p className="text-slate-500 py-6 text-center">No invoice logs found yet.</p>
                    ) : (
                        <div className="space-y-3 max-h-[70vh] overflow-auto pr-1">
                            {invoiceLogs.map((log) => (
                                <div key={log._id} className="rounded-lg border border-slate-200 bg-white p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="font-semibold text-slate-900">{log.action}</p>
                                        <span className="text-xs text-slate-500">{new Date(log.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                                    </div>
                                    <p className="text-sm text-slate-700 mt-1">{log.details || 'No additional details.'}</p>
                                    <p className="text-xs text-slate-500 mt-2">IP: {log.ipAddress || 'N/A'}</p>
                                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                                        <details className="mt-2">
                                            <summary className="text-xs cursor-pointer text-teal-700">View metadata</summary>
                                            <pre className="mt-1 text-[11px] whitespace-pre-wrap break-all rounded border border-slate-200 bg-slate-50 p-2">{JSON.stringify(log.metadata, null, 2)}</pre>
                                        </details>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default Logs;
