<?php

namespace App\Console\Commands;

use App\Models\Customer;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

class CreateAdmin extends Command
{
    protected $signature = 'shop:admin';

    protected $description = 'Create or update the admin account from ADMIN_EMAIL and ADMIN_PASSWORD';

    public function handle(): int
    {
        $credentials = [
            'email' => config('shop.admin.email'),
            'password' => config('shop.admin.password'),
        ];

        // There is deliberately no default: a missing password stops here.
        $validator = Validator::make($credentials, [
            'email' => 'required|email',
            'password' => ['required', 'string', Password::defaults()],
        ]);

        if ($validator->fails()) {
            $this->error('Ustaw poprawne zmienne ADMIN_EMAIL i ADMIN_PASSWORD (hasło: minimum 8 znaków).');

            return self::FAILURE;
        }

        $customer = Customer::firstOrNew(['email' => $credentials['email']]);
        $existed = $customer->exists;
        $passwordChanged = !$existed || !Hash::check($credentials['password'], $customer->password);

        $customer->first_name ??= 'Administrator';
        $customer->last_name ??= 'Sklepu';

        // Rehashing an unchanged password would be pointless work on every container start.
        if ($passwordChanged) {
            $customer->password = $credentials['password'];
        }

        $customer->is_admin = true;
        $customer->save();

        if ($existed && $passwordChanged) {
            $customer->tokens()->delete();
        }

        $this->info("Konto administratora gotowe: {$customer->email}");

        return self::SUCCESS;
    }
}
