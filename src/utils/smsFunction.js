import { useState } from "react";
import { supabase } from "@/globals";

const DashboardPage = () => {
    const [message, setMessage] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [recipients, setRecipients] = useState([]);
    const [senderId, setSenderId] = useState("");
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState(null);

    const addRecipient = () => {
        if (phoneNumber.trim()) {
            const cleaned = phoneNumber.trim().replace(/[\s-]/g, "");
            if (cleaned && !recipients.includes(cleaned)) {
                setRecipients([...recipients, cleaned]);
                setPhoneNumber("");
            }
        }
    };

    const removeRecipient = (index) => {
        setRecipients(recipients.filter((_, i) => i !== index));
    };

    const clearAll = () => {
        setRecipients([]);
    };

    const handleKeyPress = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addRecipient();
        }
    };

    const sendBulkSMS = async () => {
        if (recipients.length === 0) {
            setResponse({
                success: false,
                error: "Please add at least one recipient",
            });
            return;
        }
        if (!message.trim()) {
            setResponse({ success: false, error: "Please enter a message" });
            return;
        }

        setLoading(true);
        setResponse(null);

        try {
            const { data, error } = await supabase.functions.invoke(
                "send-bulk-sms",
                {
                    method: "POST",
                    body: JSON.stringify({
                        recipients, // array of phone numbers
                        message, // your message
                        sender_id: senderId || undefined, // optional
                    }),
                }
            );

            if (error) {
                setResponse({ success: false, error: error.message });
                return;
            }

            setResponse(data);

            if (data.success) {
                setMessage("");
                setRecipients([]);
                setSenderId("");
            }
        } catch (err) {
            setResponse({ success: false, error: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <div className="max-w-3xl mx-auto">
                <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">
                        Bulk SMS Sender
                    </h1>
                    <p className="text-gray-600 mb-6">
                        Send SMS to multiple recipients at once
                    </p>

                    {/* Sender ID */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Sender ID (Optional)
                        </label>
                        <input
                            type="text"
                            value={senderId}
                            onChange={(e) => setSenderId(e.target.value)}
                            placeholder="e.g., MyBrand"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            maxLength={11}
                        />
                    </div>

                    {/* Message */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Message
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Type your message here..."
                            rows={4}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                        <div className="text-sm text-gray-500 mt-1">
                            {message.length} characters
                        </div>
                    </div>

                    {/* Add Phone Number */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Add Recipients
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="e.g., 639171234567"
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <button
                                onClick={addRecipient}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                + Add
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Format: 639XXXXXXXXX (Press Enter to add)
                        </p>
                    </div>

                    {/* Recipients List */}
                    {recipients.length > 0 && (
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-3">
                                <label className="block text-sm font-medium text-gray-700">
                                    Recipients ({recipients.length})
                                </label>
                                <button
                                    onClick={clearAll}
                                    className="text-sm text-red-600 hover:text-red-700"
                                >
                                    Clear All
                                </button>
                            </div>
                            <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                                {recipients.map((number, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                                    >
                                        <span className="text-gray-700">
                                            {number}
                                        </span>
                                        <button
                                            onClick={() =>
                                                removeRecipient(index)
                                            }
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Send Button */}
                    <button
                        onClick={sendBulkSMS}
                        disabled={
                            loading ||
                            recipients.length === 0 ||
                            !message.trim()
                        }
                        className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                        {loading
                            ? "Sending..."
                            : `Send to ${recipients.length} ${
                                  recipients.length === 1
                                      ? "Recipient"
                                      : "Recipients"
                              }`}
                    </button>

                    {/* Response */}
                    {response && (
                        <div
                            className={`mt-4 p-4 rounded-lg ${
                                response.success
                                    ? "bg-green-50 border border-green-200"
                                    : "bg-red-50 border border-red-200"
                            }`}
                        >
                            <p
                                className={`font-medium ${
                                    response.success
                                        ? "text-green-800"
                                        : "text-red-800"
                                }`}
                            >
                                {response.success ? "✓ Success!" : "✗ Error"}
                            </p>
                            <p
                                className={`text-sm mt-1 ${
                                    response.success
                                        ? "text-green-700"
                                        : "text-red-700"
                                }`}
                            >
                                {response.message || response.error}
                            </p>

                            {response.details && (
                                <div className="mt-2 text-xs text-gray-700">
                                    <strong>Details:</strong>
                                    <ul className="list-disc list-inside">
                                        {Object.entries(response.details).map(
                                            ([key, value], idx) => (
                                                <li key={idx}>
                                                    {key}:{" "}
                                                    {typeof value === "string"
                                                        ? value
                                                        : JSON.stringify(value)}
                                                </li>
                                            )
                                        )}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;
