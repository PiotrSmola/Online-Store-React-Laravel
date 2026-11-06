<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="utf-8">
    <title>@yield('title')</title>
</head>
<body style="margin: 0; padding: 24px; background: #f5f5f4; font-family: Arial, sans-serif; color: #1c1917; line-height: 1.5;">
    <div style="max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 8px;">
        <h1 style="margin: 0 0 16px; font-size: 20px;">@yield('title')</h1>
        @yield('content')
        <p style="margin: 24px 0 0; font-size: 13px; color: #78716c;">Ta wiadomość została wysłana automatycznie, nie odpowiadaj na nią.</p>
    </div>
</body>
</html>
