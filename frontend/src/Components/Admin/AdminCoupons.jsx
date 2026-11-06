import { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate, useParams } from 'react-router';
import { useToast } from '../../Context/useToast';
import { useForm } from '../../hooks/useForm';
import { usePagedList } from '../../hooks/usePagedList';
import { useResource } from '../../hooks/useResource';
import { createCoupon, deleteCoupon, getCoupon, getCoupons, updateCoupon } from '../../lib/admin';
import { formatDate, formatPrice } from '../../lib/format';
import Button, { ButtonLink } from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';
import ErrorSummary from '../ui/ErrorSummary';
import Field from '../ui/Field';
import PageHeading from '../ui/PageHeading';
import Select from '../ui/Select';
import Spinner from '../ui/Spinner';
import { LINK, ListBody, TD, TH, TableRegion } from './AdminParts';

const TYPE_OPTIONS = [
  { value: 'percent', label: 'Procent' },
  { value: 'fixed', label: 'Kwota' },
];

const EMPTY = { code: '', type: 'percent', value: '', min_order: '', max_uses: '', expires_at: '', is_active: true };
const FIELD_IDS = {
  code: 'coupon-code',
  value: 'coupon-value',
  min_order: 'coupon-min_order',
  max_uses: 'coupon-max_uses',
  expires_at: 'coupon-expires_at',
};

function toFormValues(coupon) {
  return {
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    min_order: coupon.min_order === '0.00' ? '' : coupon.min_order,
    max_uses: coupon.max_uses ?? '',
    expires_at: coupon.expires_at ? coupon.expires_at.slice(0, 10) : '',
    is_active: coupon.is_active,
  };
}

function toPayload(values) {
  return {
    code: values.code.trim(),
    type: values.type,
    value: Number(values.value),
    min_order: values.min_order === '' ? 0 : Number(values.min_order),
    max_uses: values.max_uses === '' ? null : Number(values.max_uses),
    expires_at: values.expires_at || null,
    is_active: values.is_active,
  };
}

function couponValue(coupon) {
  return coupon.type === 'percent' ? `${Number(coupon.value)}%` : formatPrice(coupon.value);
}

function CouponEditor({ coupon = null }) {
  const [values, setValues] = useState(() => (coupon ? toFormValues(coupon) : EMPTY));
  const form = useForm(FIELD_IDS);
  const toast = useToast();
  const navigate = useNavigate();

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setValues((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    form.setFieldError(name, null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (form.submitting) return;

    const found = {};
    if (!values.code.trim()) found.code = 'Wpisz kod';
    if (values.value === '' || Number(values.value) <= 0) found.value = 'Wpisz wartość większą od zera';

    if (Object.keys(found).length > 0) {
      form.fail(found);
      return;
    }

    form.reset();
    form.run(async () => {
      if (coupon) await updateCoupon(coupon.id, toPayload(values));
      else await createCoupon(toPayload(values));

      toast.success('Zapisano kupon');
      navigate('/admin/coupons');
    });
  };

  const field = (name, label, props) => (
    <Field
      id={FIELD_IDS[name]}
      name={name}
      label={label}
      value={values[name]}
      error={form.errors[name]}
      onChange={handleChange}
      {...props}
    />
  );

  return (
    <form noValidate onSubmit={handleSubmit} className="mt-6 max-w-md space-y-5">
      {form.failedSubmits > 0 && form.summary.length > 0 && (
        <ErrorSummary errors={form.summary} focusKey={form.failedSubmits} title="Nie udało się zapisać kuponu" />
      )}

      {field('code', 'Kod', { required: true, maxLength: 64, autoComplete: 'off', hint: 'Litery, cyfry, - i _.' })}
      <Select label="Rodzaj" name="type" options={TYPE_OPTIONS} value={values.type} onChange={handleChange} />
      {field('value', values.type === 'percent' ? 'Wartość (%)' : 'Wartość (zł)', { required: true, inputMode: 'decimal' })}
      {field('min_order', 'Minimalne zamówienie (zł, opcjonalnie)', { inputMode: 'decimal' })}
      {field('max_uses', 'Limit użyć (opcjonalnie)', { inputMode: 'numeric', hint: 'Puste pole oznacza brak limitu.' })}
      {field('expires_at', 'Ważny do (opcjonalnie)', { type: 'date' })}
      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <input type="checkbox" name="is_active" className="size-5 accent-pine" checked={values.is_active} onChange={handleChange} />
        Aktywny
      </label>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={form.submitting}>
          Zapisz kupon
        </Button>
        <ButtonLink to="/admin/coupons" variant="secondary">
          Wróć do listy
        </ButtonLink>
      </div>
    </form>
  );
}

CouponEditor.propTypes = {
  coupon: PropTypes.object,
};

function ExistingCoupon({ id }) {
  const load = useCallback((signal) => getCoupon(id, { signal }), [id]);
  const { data, error, loading, reload } = useResource(load, `admin-coupon:${id}`);

  if (loading) return <Spinner />;

  if (error) {
    return (
      <EmptyState
        isPage
        title="Nie udało się wczytać kuponu"
        text={error.message}
        action={<Button onClick={reload}>Spróbuj ponownie</Button>}
      />
    );
  }

  return (
    <>
      <PageHeading documentTitle={`Kupon ${data.code}`}>{`Kupon ${data.code}`}</PageHeading>
      <CouponEditor coupon={data} />
    </>
  );
}

ExistingCoupon.propTypes = {
  id: PropTypes.string.isRequired,
};

export function AdminCouponForm() {
  const { id } = useParams();

  if (id) return <ExistingCoupon key={id} id={id} />;

  return (
    <>
      <PageHeading>Nowy kupon</PageHeading>
      <CouponEditor />
    </>
  );
}

export default function AdminCoupons() {
  const list = usePagedList(getCoupons);
  const [deleting, setDeleting] = useState(null);
  const toast = useToast();

  const handleDelete = async () => {
    const coupon = deleting;
    setDeleting(null);

    try {
      const { message } = await deleteCoupon(coupon.id);
      toast.success(message);
      list.afterRemoval();
    } catch (error) {
      if (error.status !== 401) toast.error(error.message);
    }
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <PageHeading>Kupony</PageHeading>
        <ButtonLink to="/admin/coupons/new">Dodaj kupon</ButtonLink>
      </div>

      <ListBody list={list} emptyTitle="Nie ma jeszcze kuponów">
        <TableRegion label="Lista kuponów">
          <thead>
            <tr>
              <th scope="col" className={TH}>
                Kod
              </th>
              <th scope="col" className={TH}>
                Wartość
              </th>
              <th scope="col" className={TH}>
                Użycia
              </th>
              <th scope="col" className={TH}>
                Ważny do
              </th>
              <th scope="col" className={TH}>
                Stan
              </th>
              <th scope="col" className={TH}>
                <span className="sr-only">Działania</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((coupon) => (
              <tr key={coupon.id}>
                <td className={TD}>
                  <Link to={`/admin/coupons/${coupon.id}`} className={LINK}>
                    {coupon.code}
                  </Link>
                </td>
                <td className={TD}>{couponValue(coupon)}</td>
                <td className={TD}>
                  {coupon.used_count}
                  {coupon.max_uses ? ` z ${coupon.max_uses}` : ''}
                </td>
                <td className={TD}>{coupon.expires_at ? formatDate(coupon.expires_at) : 'Bez daty'}</td>
                <td className={TD}>{coupon.is_active ? 'Aktywny' : 'Wyłączony'}</td>
                <td className={TD}>
                  <Button variant="plain" aria-label={`Usuń: ${coupon.code}`} onClick={() => setDeleting(coupon)}>
                    Usuń
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </TableRegion>
      </ListBody>

      <ConfirmDialog
        open={deleting !== null}
        title="Usunąć kupon?"
        text={deleting?.code ?? ''}
        confirmLabel="Usuń kupon"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
