import { useState } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import FormField from '../common/FormField';

const initialValues = { name: '', email: '', phone: '', message: '' };

const validate = (values) => {
  const errors = {};
  if (!values.name.trim()) errors.name = 'Enter your name.';
  else if (values.name.trim().length < 2) errors.name = 'Your name must be at least 2 characters.';

  if (!values.email.trim()) errors.email = 'Enter your email address.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  const phoneDigits = values.phone.replace(/[^\d]/g, '');
  if (!values.phone.trim()) errors.phone = 'Enter your phone number.';
  else if (phoneDigits.length < 7 || phoneDigits.length > 15) {
    errors.phone = 'Enter a valid phone number with 7–15 digits.';
  }

  if (!values.message.trim()) errors.message = 'Tell us what you would like to know.';
  else if (values.message.trim().length < 10) {
    errors.message = 'Your message must be at least 10 characters.';
  }

  return errors;
};

export default function PropertyEnquiryForm({ property }) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const updateField = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    if (hasSubmitted) setHasSubmitted(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setHasSubmitted(false);
      return;
    }

    setHasSubmitted(true);
    setValues(initialValues);
  };

  return (
    <form className="enquiry-form" onSubmit={handleSubmit} noValidate>
      <div className="enquiry-form__reference">
        <span>Property reference</span>
        <strong>{property.id}</strong>
        <span className="enquiry-form__reference-title">{property.title}</span>
      </div>

      {hasSubmitted ? (
        <div className="form-success" role="status">
          <CheckCircle2 size={20} aria-hidden="true" />
          <div>
            <p className="form-success__title">Enquiry noted</p>
            <p>
              Your details have been captured for follow-up by the EstateVista advisory team.
            </p>
          </div>
        </div>
      ) : null}

      {Object.keys(errors).length > 0 ? (
        <p className="form-error-summary" role="alert">
          Please correct the highlighted fields before continuing.
        </p>
      ) : null}

      <div className="enquiry-form__grid">
        <FormField
          label="Name"
          id="enquiry-name"
          name="name"
          value={values.name}
          onChange={updateField('name')}
          error={errors.name}
          required
          autoComplete="name"
        />
        <FormField
          label="Email"
          id="enquiry-email"
          name="email"
          type="email"
          value={values.email}
          onChange={updateField('email')}
          error={errors.email}
          required
          autoComplete="email"
        />
        <FormField
          label="Phone"
          id="enquiry-phone"
          name="phone"
          type="tel"
          value={values.phone}
          onChange={updateField('phone')}
          error={errors.phone}
          required
          autoComplete="tel"
        />
        <FormField
          label="Property"
          id="enquiry-property"
          name="property"
          value={`${property.title} (${property.id})`}
          readOnly
          className="form-field--readonly"
        />
        <FormField
          label="Message"
          id="enquiry-message"
          name="message"
          as="textarea"
          rows="5"
          value={values.message}
          onChange={updateField('message')}
          error={errors.message}
          required
          className="enquiry-form__message"
          placeholder="I would like to arrange a viewing, or learn more about this property."
        />
      </div>

      <div className="enquiry-form__footer">
        <button type="submit" className="button button--primary button--md">
          <Send size={16} aria-hidden="true" />
          Submit enquiry
        </button>
        <p>
          We will use your details to arrange the next conversation or viewing.
        </p>
      </div>
    </form>
  );
}
