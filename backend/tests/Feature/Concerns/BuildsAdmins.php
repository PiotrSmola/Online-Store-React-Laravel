<?php

namespace Tests\Feature\Concerns;

use App\Models\Customer;

trait BuildsAdmins
{
    protected function createAdmin(string $email = 'admin@example.com'): Customer
    {
        $admin = $this->createCustomer(['email' => $email, 'first_name' => 'Ada']);
        $admin->forceFill(['is_admin' => true])->save();

        return $admin;
    }
}
