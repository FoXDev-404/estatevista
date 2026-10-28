import { Link } from 'react-router-dom';
import { ArrowRight, Home, Search } from 'lucide-react';
import Container from '../components/common/Container';
import PageMeta from '../components/common/PageMeta';
import ErrorState from '../components/common/ErrorState';

export default function NotFound() {
  return (
    <>
      <PageMeta
        title="Page not found"
        description="The page you requested could not be found on EstateVista."
        noIndex
      />
      <section className="not-found-page section">
        <span className="not-found-page__watermark" aria-hidden="true">
          404
        </span>
        <Container className="not-found-page__inner">
          <ErrorState
            code="404"
            title="This address is not on our map."
            titleAs="h1"
            description="The page may have moved or no longer exists. Return to the collection, or start again from the beginning."
            action={
              <div className="not-found-page__actions">
                <Link className="button button--primary button--md" to="/">
                  <Home size={16} aria-hidden="true" />
                  Return home
                </Link>
                <Link className="button button--secondary button--md" to="/properties">
                  <Search size={16} aria-hidden="true" />
                  Browse properties
                </Link>
              </div>
            }
          />
          <div className="not-found-page__links">
            <p>You may be looking for:</p>
            <ul>
              <li>
                <Link to="/properties?purpose=sale">
                  Properties for sale
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link to="/services">
                  Our services
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link to="/contact">
                  Contact EstateVista
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
            </ul>
          </div>
        </Container>
      </section>
    </>
  );
}
