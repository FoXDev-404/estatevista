import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AdminPropertyForm from '../components/admin/PropertyForm';
import seedProperties from '../data/properties';

const fillRequiredFields = async (user, overrides = {}) => {
  await user.type(
    screen.getByRole('textbox', { name: 'Property title' }),
    overrides.title || 'Casa Test',
  );
  if (overrides.slug) {
    const slug = screen.getByRole('textbox', { name: 'Slug' });
    await user.clear(slug);
    await user.type(slug, overrides.slug);
  }
  await user.type(screen.getByRole('spinbutton', { name: 'Price (INR)' }), overrides.price || '2500000');
  await user.type(screen.getByRole('textbox', { name: 'City' }), 'Pune');
  await user.type(screen.getByRole('textbox', { name: 'Area or locality' }), 'Koregaon Park');
  await user.type(
    screen.getByRole('textbox', { name: 'Full address' }),
    '8 Lane Seven, Pune 411001',
  );
  await user.type(screen.getByRole('spinbutton', { name: 'Area' }), '1800');
  await user.type(
    screen.getByRole('textbox', { name: 'Description' }),
    'A calm courtyard house with a deep verandah, filtered light and a private garden.',
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Image paths or URLs' }),
    '/images/property-1.jpg',
  );
};

describe('AdminPropertyForm', () => {
  it('shows validation feedback and submits a complete record', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <AdminPropertyForm
        mode="create"
        existingProperties={seedProperties}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        submitLabel="Create property"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Create property' }));

    expect(document.querySelector('.admin-form__error-summary')).toHaveTextContent(
      /some fields need attention/i,
    );
    expect(screen.getByRole('textbox', { name: 'Property title' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(onSubmit).not.toHaveBeenCalled();

    await fillRequiredFields(user);

    expect(screen.getByRole('textbox', { name: 'Slug' })).toHaveValue('casa-test');
    await user.click(screen.getByRole('button', { name: 'Create property' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      title: 'Casa Test',
      slug: 'casa-test',
      price: 2500000,
      status: 'available',
      location: {
        city: 'Pune',
        area: 'Koregaon Park',
        address: '8 Lane Seven, Pune 411001',
      },
      specifications: {
        bedrooms: 0,
        bathrooms: 0,
        area: 1800,
        areaUnit: 'sqft',
      },
      images: ['/images/property-1.jpg'],
    });
  });

  it('keeps the form open and reports a duplicate slug', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <AdminPropertyForm
        mode="create"
        existingProperties={seedProperties}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        submitLabel="Create property"
      />,
    );

    await fillRequiredFields(user, {
      title: 'Duplicate Villa',
      slug: 'the-arbour-residence-worli',
    });
    await user.click(screen.getByRole('button', { name: 'Create property' }));

    await waitFor(() => {
      expect(screen.getByText(/that slug is already in use/i)).toBeInTheDocument();
    });
    expect(document.querySelector('.admin-form__error-summary')).toHaveTextContent(
      /some fields need attention/i,
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
