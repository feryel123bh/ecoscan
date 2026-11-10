import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ProblemDetails, ProblemDetailsFilter } from './problem-details.filter';

function mockHost(url = '/api/v1/scans/42') {
  const json = jest.fn();
  const type = jest.fn(() => ({ json }));
  const status = jest.fn(() => ({ type }));
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ url, originalUrl: url, method: 'GET' }),
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;
  const body = (): ProblemDetails => (json.mock.calls as [[ProblemDetails]])[0][0];
  return { host, status, type, body };
}

describe('ProblemDetailsFilter', () => {
  const filter = new ProblemDetailsFilter();
  beforeAll(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));

  it('maps an HTTP exception to RFC 9457 problem details', () => {
    const { host, status, type, body } = mockHost();
    filter.catch(new NotFoundException('Scan not found.'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(type).toHaveBeenCalledWith('application/problem+json');
    expect(body()).toEqual({
      type: '/problems/not-found',
      title: 'Not Found',
      status: 404,
      detail: 'Scan not found.',
      instance: '/api/v1/scans/42',
    });
  });

  it('puts validation messages in an "errors" extension member', () => {
    const { host, body } = mockHost();
    filter.catch(new BadRequestException(['url must be a URL address']), host);
    expect(body()).toMatchObject({ status: 400, errors: ['url must be a URL address'] });
  });

  it('keeps the message of a 503', () => {
    const { host, body } = mockHost('/api/v1/health');
    filter.catch(new ServiceUnavailableException('Redis is unreachable.'), host);
    expect(body()).toMatchObject({ status: 503, title: 'Service Unavailable' });
  });

  it('hides the details of unexpected errors', () => {
    const { host, status, body } = mockHost();
    filter.catch(new Error('ECONNREFUSED 10.0.0.5:6380'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(body())).not.toContain('10.0.0.5');
  });
});
