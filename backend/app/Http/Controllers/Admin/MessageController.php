<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    private const PER_PAGE = 20;

    public function index(Request $request)
    {
        $validated = $request->validate([
            'unread' => 'nullable|boolean',
            'page' => 'nullable|integer|min:1',
        ]);

        $messages = ContactMessage::query()
            ->when(!empty($validated['unread']), fn ($query) => $query->whereNull('read_at'))
            ->orderBy('id', 'desc')
            ->paginate(self::PER_PAGE)
            ->withQueryString();

        return response()->json($messages);
    }

    public function markRead(ContactMessage $message)
    {
        // Marking twice keeps the first moment it was read.
        if ($message->read_at === null) {
            $message->read_at = now();
            $message->save();
        }

        return response()->json($message);
    }

    public function destroy(ContactMessage $message)
    {
        $message->delete();

        return response()->json(['message' => 'Wiadomość została usunięta.']);
    }
}
