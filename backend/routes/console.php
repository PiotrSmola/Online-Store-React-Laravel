<?php

use Illuminate\Support\Facades\Schedule;

// Run by the scheduler service in docker-compose.yml.
Schedule::command('orders:expire-unpaid')->hourly()->withoutOverlapping();
Schedule::command('newsletter:prune')->daily()->withoutOverlapping();
